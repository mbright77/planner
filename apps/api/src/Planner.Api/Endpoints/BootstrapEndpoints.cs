using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Bootstrap;
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

        var response = new BootstrapResponse(
            membership.FamilyId,
            membership.Family.Name,
            membership.Family.Timezone,
            membership.Family.Profiles
                .OrderBy(x => x.DisplayName)
                .Select(x => new ProfileSummary(x.Id, x.DisplayName, x.ColorKey, x.IsActive))
                .ToArray(),
            new MembershipSummary(
                membership.UserId,
                httpContext.User.FindFirstValue(ClaimTypes.Email)
                    ?? httpContext.User.FindFirst("email")?.Value
                    ?? string.Empty,
                membership.Role.ToString()));

        return Results.Ok(response);
    }
}
