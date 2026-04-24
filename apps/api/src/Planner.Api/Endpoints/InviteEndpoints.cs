using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Auth;
using Planner.Contracts.Invites;
using Planner.Domain;
using Planner.Infrastructure.Auth;
using Planner.Infrastructure.Identity;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class InviteEndpoints
{
    private static readonly TimeSpan InviteLifetime = TimeSpan.FromDays(7);

    public static IEndpointRouteBuilder MapInviteEndpoints(this IEndpointRouteBuilder app)
    {
        var invites = app.MapGroup("/api/v1/invites");

        invites.MapGet("/{token}", GetInviteAsync)
            .Produces<FamilyInviteDetailsResponse>(StatusCodes.Status200OK);
        invites.MapPost("/{token}/accept", AcceptInviteAsync)
            .Produces<AuthResponse>(StatusCodes.Status200OK);

        var familyInvites = app.MapGroup("/api/v1/family-invites")
            .RequireAuthorization();

        familyInvites.MapGet(string.Empty, GetFamilyInvitesAsync)
            .Produces<IReadOnlyList<FamilyInviteResponse>>(StatusCodes.Status200OK);
        familyInvites.MapPost(string.Empty, CreateInviteAsync)
            .Produces<FamilyInviteResponse>(StatusCodes.Status201Created);

        return app;
    }

    private static async Task<IResult> GetFamilyInvitesAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var invites = await dbContext.FamilyInvites
            .AsNoTracking()
            .Include(x => x.Profile)
            .Where(x => x.FamilyId == membership.FamilyId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new FamilyInviteResponse(
                x.Id,
                x.Email,
                x.Token,
                x.ExpiresAtUtc,
                x.CreatedAtUtc,
                x.AcceptedAtUtc != null,
                x.ProfileId,
                x.Profile != null ? x.Profile.DisplayName : null))
            .ToListAsync(cancellationToken);

        return Results.Ok(invites);
    }

    private static async Task<IResult> CreateInviteAsync(
        HttpContext httpContext,
        CreateFamilyInviteRequest request,
        PlannerDbContext dbContext,
        UserManager<PlannerIdentityUser> userManager,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        if (membership.Role != FamilyRole.Admin)
        {
            return Results.Forbid();
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return Results.BadRequest(new { message = "Invite email is required." });
        }

        var existingUser = await userManager.FindByEmailAsync(normalizedEmail);
        if (existingUser is not null)
        {
            var existingMembership = await dbContext.FamilyMemberships.AnyAsync(
                x => x.FamilyId == membership.FamilyId && x.UserId == existingUser.Id,
                cancellationToken);

            if (existingMembership)
            {
                return Results.Conflict(new { message = "This person is already a member of your family." });
            }
        }

        var now = DateTimeOffset.UtcNow;
        Profile? inviteProfile = null;

        if (request.ProfileId is not null)
        {
            inviteProfile = await dbContext.Profiles
                .FirstOrDefaultAsync(
                    x => x.Id == request.ProfileId.Value && x.FamilyId == membership.FamilyId,
                    cancellationToken);

            if (inviteProfile is null)
            {
                return Results.BadRequest(new { message = "The selected profile could not be found." });
            }

            if (inviteProfile.LinkedUserId is not null)
            {
                return Results.Conflict(new { message = "This profile already has sign-in access." });
            }
        }

        var existingInvites = await dbContext.FamilyInvites
            .Include(x => x.Profile)
            .Where(x => x.FamilyId == membership.FamilyId && x.Email == normalizedEmail)
            .ToListAsync(cancellationToken);

        var activeInvite = existingInvites.FirstOrDefault(
            x => x.AcceptedAtUtc == null
                && x.ExpiresAtUtc > now
                && x.ProfileId == request.ProfileId);

        if (activeInvite is not null)
        {
            return Results.Ok(ToResponse(activeInvite));
        }

        if (request.ProfileId is not null)
        {
            var profileInviteExists = existingInvites.Any(
                x => x.ProfileId == request.ProfileId
                    && x.AcceptedAtUtc == null
                    && x.ExpiresAtUtc > now);

            if (profileInviteExists)
            {
                return Results.Conflict(new { message = "This profile already has a pending invite." });
            }
        }

        var invite = new FamilyInvite
        {
            Id = Guid.NewGuid(),
            FamilyId = membership.FamilyId,
            ProfileId = request.ProfileId,
            Profile = inviteProfile,
            Email = normalizedEmail,
            Token = Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant(),
            CreatedAtUtc = now,
            ExpiresAtUtc = now.Add(InviteLifetime),
        };

        dbContext.FamilyInvites.Add(invite);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/v1/invites/{invite.Token}", ToResponse(invite));
    }

    private static async Task<IResult> GetInviteAsync(
        string token,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var invite = await dbContext.FamilyInvites
            .AsNoTracking()
            .Include(x => x.Family)
            .Include(x => x.Profile)
            .FirstOrDefaultAsync(x => x.Token == token, cancellationToken);

        if (invite is null)
        {
            return Results.NotFound();
        }

        var isExpired = invite.ExpiresAtUtc <= DateTimeOffset.UtcNow;

        return Results.Ok(new FamilyInviteDetailsResponse(
            invite.Email,
            invite.Family.Name,
            invite.ExpiresAtUtc,
            isExpired,
            invite.AcceptedAtUtc != null,
            invite.ProfileId,
            invite.Profile?.DisplayName,
            invite.Profile?.ColorKey));
    }

    private static async Task<IResult> AcceptInviteAsync(
        string token,
        AcceptFamilyInviteRequest request,
        PlannerDbContext dbContext,
        UserManager<PlannerIdentityUser> userManager,
        IJwtTokenService jwtTokenService,
        CancellationToken cancellationToken)
    {
        var invite = await dbContext.FamilyInvites
            .Include(x => x.Family)
            .Include(x => x.Profile)
            .FirstOrDefaultAsync(x => x.Token == token, cancellationToken);

        if (invite is null)
        {
            return Results.NotFound();
        }

        if (invite.AcceptedAtUtc is not null)
        {
            return Results.Conflict(new { message = "This invite has already been used." });
        }

        var now = DateTimeOffset.UtcNow;
        if (invite.ExpiresAtUtc <= now)
        {
            return Results.BadRequest(new { message = "This invite has expired." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (!string.Equals(invite.Email, normalizedEmail, StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { message = "Invite email does not match this invitation." });
        }

        var existingUser = await userManager.FindByEmailAsync(normalizedEmail);
        if (existingUser is not null)
        {
            return Results.Conflict(new { message = "An account with this email already exists." });
        }

        var user = new PlannerIdentityUser
        {
            UserName = normalizedEmail,
            Email = normalizedEmail,
            EmailConfirmed = true,
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            return Results.BadRequest(new
            {
                message = "Unable to create account.",
                errors = createResult.Errors.Select(x => x.Description).ToArray(),
            });
        }

        var membership = new FamilyMembership
        {
            Id = Guid.NewGuid(),
            FamilyId = invite.FamilyId,
            UserId = user.Id,
            Role = FamilyRole.Member,
            CreatedAtUtc = now,
        };

        Profile? createdProfile = null;

        if (invite.ProfileId is not null)
        {
            if (invite.Profile is null || invite.Profile.FamilyId != invite.FamilyId)
            {
                return Results.BadRequest(new { message = "This invite is linked to a missing profile." });
            }

            if (invite.Profile.LinkedUserId is not null)
            {
                return Results.Conflict(new { message = "This profile already has sign-in access." });
            }

            invite.Profile.LinkedUserId = user.Id;
        }
        else
        {
            var displayName = request.DisplayName?.Trim();
            var colorKey = request.ColorKey?.Trim().ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(colorKey))
            {
                return Results.BadRequest(new { message = "Display name and color key are required for new profiles." });
            }

            createdProfile = new Profile
            {
                Id = Guid.NewGuid(),
                FamilyId = invite.FamilyId,
                LinkedUserId = user.Id,
                DisplayName = displayName,
                ColorKey = colorKey,
                IsActive = true,
            };

            dbContext.Profiles.Add(createdProfile);
        }

        invite.AcceptedAtUtc = now;
        invite.AcceptedByUserId = user.Id;

        dbContext.FamilyMemberships.Add(membership);
        await dbContext.SaveChangesAsync(cancellationToken);

        var tokenResponse = jwtTokenService.CreateAccessToken(user, invite.FamilyId, FamilyRole.Member.ToString());

        return Results.Ok(new AuthResponse(tokenResponse.AccessToken, tokenResponse.ExpiresAtUtc));
    }

    private static FamilyInviteResponse ToResponse(FamilyInvite invite)
    {
        return new FamilyInviteResponse(
            invite.Id,
            invite.Email,
            invite.Token,
            invite.ExpiresAtUtc,
            invite.CreatedAtUtc,
            invite.AcceptedAtUtc != null,
            invite.ProfileId,
            invite.Profile?.DisplayName);
    }

    private static Task<FamilyMembership?> GetMembershipAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.GetRequiredUserId();

        return dbContext.FamilyMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
    }
}
