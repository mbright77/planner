using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Planner.Api.Extensions;
using Planner.Contracts.Privacy;
using Planner.Domain;
using Planner.Infrastructure.Identity;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Persistence;
using Planner.Infrastructure.Security;

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
        IGoogleOAuthClient googleOAuthClient,
        ITokenCipher tokenCipher,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger(nameof(PrivacyEndpoints));

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

        await DeleteGoogleCalendarDataAsync(userId, dbContext, googleOAuthClient, tokenCipher, logger, cancellationToken);

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
        IGoogleOAuthClient googleOAuthClient,
        ITokenCipher tokenCipher,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger(nameof(PrivacyEndpoints));

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

        // The FamilyId cascade takes GoogleCalendarConnection/UserCalendarPreference with the
        // Family row below, but GoogleOAuthState has no FamilyId FK, and cascade deletion never
        // gives us a chance to revoke at Google first - both need handling before Remove(family).
        var familyGoogleConnections = await dbContext.GoogleCalendarConnections
            .Where(x => familyUserIds.Contains(x.UserId))
            .ToListAsync(cancellationToken);
        foreach (var googleConnection in familyGoogleConnections)
        {
            await GoogleConnectionCleanup.TryRevokeAsync(googleConnection, googleOAuthClient, tokenCipher, logger, cancellationToken);
        }

        var familyOauthStates = await dbContext.GoogleOAuthStates
            .Where(x => familyUserIds.Contains(x.UserId))
            .ToListAsync(cancellationToken);
        if (familyOauthStates.Count > 0)
        {
            dbContext.GoogleOAuthStates.RemoveRange(familyOauthStates);
        }

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

    // No FK links these tables to AspNetUsers, so userManager.DeleteAsync alone would orphan a
    // connection (and its encrypted refresh token) with a dangling UserId.
    private static async Task DeleteGoogleCalendarDataAsync(
        string userId,
        PlannerDbContext dbContext,
        IGoogleOAuthClient googleOAuthClient,
        ITokenCipher tokenCipher,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var connection = await dbContext.GoogleCalendarConnections
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

        if (connection is not null)
        {
            await GoogleConnectionCleanup.TryRevokeAsync(connection, googleOAuthClient, tokenCipher, logger, cancellationToken);
            dbContext.GoogleCalendarConnections.Remove(connection);
        }

        var preference = await dbContext.UserCalendarPreferences
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (preference is not null)
        {
            dbContext.UserCalendarPreferences.Remove(preference);
        }

        var oauthStates = await dbContext.GoogleOAuthStates
            .Where(x => x.UserId == userId)
            .ToListAsync(cancellationToken);
        if (oauthStates.Count > 0)
        {
            dbContext.GoogleOAuthStates.RemoveRange(oauthStates);
        }

        if (connection is not null || preference is not null || oauthStates.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
