using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Bootstrap;
using Planner.Domain;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class BootstrapEndpoints
{
    public static IEndpointRouteBuilder MapBootstrapEndpoints(this IEndpointRouteBuilder app)
    {
        var me = app.MapGroup("/api/v1/me")
            .RequireAuthorization();

        me.MapGet("/bootstrap", GetBootstrapAsync)
            .Produces<BootstrapResponse>(StatusCodes.Status200OK);

        return app;
    }

    private static async Task<IResult> GetBootstrapAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.GetRequiredUserId();

        var membership = await dbContext.FamilyMemberships
            .AsNoTracking()
            .Include(x => x.Family)
            .ThenInclude(x => x.Profiles)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

        if (membership is null)
        {
            return Results.NotFound();
        }

        var familyMemberships = await dbContext.FamilyMemberships
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId)
            .ToListAsync(cancellationToken);

        var response = new BootstrapResponse(
            membership.FamilyId,
            membership.Family.Name,
            membership.Family.Timezone,
            membership.Family.Profiles
                .OrderBy(x => x.DisplayName)
                .Select(x => new ProfileSummary(
                    x.Id,
                    x.DisplayName,
                    x.ColorKey,
                    x.IsActive,
                    x.PreferredLanguage,
                    x.LinkedUserId))
                .ToArray(),
            familyMemberships
                .OrderBy(x => x.CreatedAtUtc)
                .Select(x => new MembershipSummary(
                    x.UserId,
                    string.Empty,
                    x.Role.ToString(),
                    x.Role == FamilyRole.Admin || CanPlanMealsForUser(membership.Family.Profiles, x.UserId)))
                .ToArray(),
            new MembershipSummary(
                membership.UserId,
                httpContext.User.FindFirstValue(ClaimTypes.Email)
                    ?? httpContext.User.FindFirst("email")?.Value
                    ?? string.Empty,
                membership.Role.ToString(),
                CanPlanMeals(membership)));

        return Results.Ok(response);
    }

    private static bool CanPlanMeals(FamilyMembership membership)
    {
        if (membership.Role == FamilyRole.Admin)
        {
            return true;
        }

        var linkedProfile = membership.Family.Profiles.FirstOrDefault(x => x.LinkedUserId == membership.UserId);

        return linkedProfile?.IsActive ?? true;
    }

    private static bool CanPlanMealsForUser(IEnumerable<Profile> profiles, string userId)
    {
        var linkedProfile = profiles.FirstOrDefault(x => x.LinkedUserId == userId);

        return linkedProfile?.IsActive ?? true;
    }
}
