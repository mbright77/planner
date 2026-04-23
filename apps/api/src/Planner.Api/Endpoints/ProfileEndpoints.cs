using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Profiles;
using Planner.Domain;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var profiles = app.MapGroup("/api/v1/profiles")
            .RequireAuthorization();

        profiles.MapGet(string.Empty, GetProfilesAsync);
        profiles.MapPost(string.Empty, CreateProfileAsync);
        profiles.MapPut("/{profileId:guid}", UpdateProfileAsync);

        return app;
    }

    private static async Task<IResult> GetProfilesAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var profiles = await dbContext.Profiles
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId)
            .OrderBy(x => x.DisplayName)
            .Select(x => new ProfileResponse(x.Id, x.DisplayName, x.ColorKey, x.IsActive))
            .ToListAsync(cancellationToken);

        return Results.Ok(profiles);
    }

    private static async Task<IResult> CreateProfileAsync(
        HttpContext httpContext,
        CreateProfileRequest request,
        PlannerDbContext dbContext,
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

        var profile = new Profile
        {
            Id = Guid.NewGuid(),
            FamilyId = membership.FamilyId,
            DisplayName = request.DisplayName.Trim(),
            ColorKey = request.ColorKey.Trim().ToLowerInvariant(),
            IsActive = true,
        };

        dbContext.Profiles.Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/v1/profiles/{profile.Id}", new ProfileResponse(
            profile.Id,
            profile.DisplayName,
            profile.ColorKey,
            profile.IsActive));
    }

    private static async Task<IResult> UpdateProfileAsync(
        HttpContext httpContext,
        Guid profileId,
        UpdateProfileRequest request,
        PlannerDbContext dbContext,
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

        var profile = await dbContext.Profiles
            .FirstOrDefaultAsync(x => x.Id == profileId && x.FamilyId == membership.FamilyId, cancellationToken);

        if (profile is null)
        {
            return Results.NotFound();
        }

        profile.DisplayName = request.DisplayName.Trim();
        profile.ColorKey = request.ColorKey.Trim().ToLowerInvariant();
        profile.IsActive = request.IsActive;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new ProfileResponse(profile.Id, profile.DisplayName, profile.ColorKey, profile.IsActive));
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
