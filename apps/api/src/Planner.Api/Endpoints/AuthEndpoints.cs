using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Planner.Contracts.Auth;
using Planner.Domain;
using Planner.Infrastructure.Auth;
using Planner.Infrastructure.Identity;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/v1/auth");

        auth.MapPost("/register", RegisterAsync);
        auth.MapPost("/login", LoginAsync);

        return app;
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        UserManager<PlannerIdentityUser> userManager,
        PlannerDbContext dbContext,
        IJwtTokenService jwtTokenService,
        CancellationToken cancellationToken)
    {
        var existingUser = await userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
        {
            return Results.Conflict(new { message = "An account with this email already exists." });
        }

        var user = new PlannerIdentityUser
        {
            UserName = request.Email,
            Email = request.Email,
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

        var now = DateTimeOffset.UtcNow;
        var family = new Family
        {
            Id = Guid.NewGuid(),
            Name = request.FamilyName,
            Timezone = request.Timezone,
            CreatedAtUtc = now,
        };

        var membership = new FamilyMembership
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            UserId = user.Id,
            Role = FamilyRole.Admin,
            CreatedAtUtc = now,
        };

        var profile = new Profile
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            DisplayName = request.DisplayName,
            ColorKey = request.ColorKey,
            IsActive = true,
        };

        dbContext.Families.Add(family);
        dbContext.FamilyMemberships.Add(membership);
        dbContext.Profiles.Add(profile);

        await dbContext.SaveChangesAsync(cancellationToken);

        var token = jwtTokenService.CreateAccessToken(user, family.Id, FamilyRole.Admin.ToString());

        return Results.Ok(new AuthResponse(token.AccessToken, token.ExpiresAtUtc));
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        UserManager<PlannerIdentityUser> userManager,
        PlannerDbContext dbContext,
        IJwtTokenService jwtTokenService,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            return Results.Unauthorized();
        }

        var passwordValid = await userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordValid)
        {
            return Results.Unauthorized();
        }

        var membership = await dbContext.FamilyMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == user.Id, cancellationToken);

        if (membership is null)
        {
            return Results.Problem("No family membership found for this user.", statusCode: StatusCodes.Status409Conflict);
        }

        var token = jwtTokenService.CreateAccessToken(user, membership.FamilyId, membership.Role.ToString());

        return Results.Ok(new AuthResponse(token.AccessToken, token.ExpiresAtUtc));
    }
}
