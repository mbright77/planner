using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Privacy;
using Planner.Domain;
using Planner.Infrastructure.Identity;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class PrivacyEndpoints
{
    public static IEndpointRouteBuilder MapPrivacyEndpoints(this IEndpointRouteBuilder app)
    {
        var privacy = app.MapGroup("/api/v1/privacy")
            .RequireAuthorization();

        privacy.MapPost("/account/delete", DeleteAccountAsync);
        privacy.MapPost("/family/delete", DeleteFamilyAsync);

        return app;
    }

    private static async Task<IResult> DeleteAccountAsync(
        HttpContext httpContext,
        DeleteAccountRequest request,
        PlannerDbContext dbContext,
        UserManager<PlannerIdentityUser> userManager,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.GetRequiredUserId();
        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return Results.NotFound();
        }

        var passwordValid = await userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordValid)
        {
            return Results.BadRequest(new { message = "Password is incorrect." });
        }

        var membership = await dbContext.FamilyMemberships
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

        if (membership is not null)
        {
            var familyMemberCount = await dbContext.FamilyMemberships
                .CountAsync(x => x.FamilyId == membership.FamilyId, cancellationToken);

            if (familyMemberCount <= 1)
            {
                return Results.Conflict(new { message = "Use family deletion when removing the last adult in the family." });
            }

            dbContext.FamilyMemberships.Remove(membership);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var deleteResult = await userManager.DeleteAsync(user);
        if (!deleteResult.Succeeded)
        {
            return Results.BadRequest(new
            {
                message = "Unable to delete account.",
                errors = deleteResult.Errors.Select(x => x.Description).ToArray(),
            });
        }

        return Results.Ok(new { message = "Account deleted." });
    }

    private static async Task<IResult> DeleteFamilyAsync(
        HttpContext httpContext,
        DeleteFamilyRequest request,
        PlannerDbContext dbContext,
        UserManager<PlannerIdentityUser> userManager,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.GetRequiredUserId();
        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return Results.NotFound();
        }

        var passwordValid = await userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordValid)
        {
            return Results.BadRequest(new { message = "Password is incorrect." });
        }

        var membership = await dbContext.FamilyMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        if (membership.Role != FamilyRole.Admin)
        {
            return Results.Forbid();
        }

        var family = await dbContext.Families
            .FirstOrDefaultAsync(x => x.Id == membership.FamilyId, cancellationToken);
        if (family is null)
        {
            return Results.NotFound();
        }

        var familyUserIds = await dbContext.FamilyMemberships
            .Where(x => x.FamilyId == membership.FamilyId)
            .Select(x => x.UserId)
            .ToListAsync(cancellationToken);

        dbContext.Families.Remove(family);
        await dbContext.SaveChangesAsync(cancellationToken);

        var familyUsers = await userManager.Users
            .Where(x => familyUserIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        foreach (var familyUser in familyUsers)
        {
            await userManager.DeleteAsync(familyUser);
        }

        return Results.Ok(new { message = "Family deleted." });
    }
}
