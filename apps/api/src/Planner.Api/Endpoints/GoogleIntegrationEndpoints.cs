using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Planner.Api.Extensions;
using Planner.Contracts.Integrations;
using Planner.Domain;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Persistence;
using Planner.Infrastructure.Security;

namespace Planner.Api.Endpoints;

public static class GoogleIntegrationEndpoints
{
    public static IEndpointRouteBuilder MapGoogleIntegrationEndpoints(this IEndpointRouteBuilder app)
    {
        // The callback is the one anonymous route in this feature (Google redirects the browser
        // here with no Authorization header), so it gets its own group per the repo convention
        // of splitting mixed-auth features into separate groups (see InviteEndpoints.cs).
        var authenticated = app.MapGroup("/api/v1/integrations/google")
            .RequireAuthorization();
        var anonymous = app.MapGroup("/api/v1/integrations/google");

        authenticated.MapPost("/authorize", AuthorizeAsync)
            .Produces<GoogleAuthorizationUrlResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        anonymous.MapGet("/callback", CallbackAsync);

        authenticated.MapPost("/disconnect", DisconnectAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<IResult> AuthorizeAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        IGoogleOAuthClient oAuthClient,
        IOptions<GoogleOptions> googleOptions,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var options = googleOptions.Value;
        if (!options.IsConfigured)
        {
            return Results.BadRequest(new { message = "Google integration is not configured." });
        }

        var now = DateTimeOffset.UtcNow;

        // Piggybacked cleanup, scoped to this user so the query stays small and a concurrent
        // authorize call from a *different* user can never contend on the same rows. DateTimeOffset
        // comparisons don't translate on the SQLite test provider, so filter in-memory.
        var thisUsersStates = await dbContext.GoogleOAuthStates
            .Where(x => x.UserId == membership.UserId)
            .ToListAsync(cancellationToken);
        var expiredStates = thisUsersStates.Where(x => x.ExpiresAtUtc < now).ToList();
        if (expiredStates.Count > 0)
        {
            dbContext.GoogleOAuthStates.RemoveRange(expiredStates);
            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                // A second concurrent authorize call from this same user (e.g. a double-click)
                // already deleted these expired rows - nothing left to clean up.
                dbContext.ChangeTracker.Clear();
            }
        }

        var state = PkceGenerator.GenerateState();
        var codeVerifier = PkceGenerator.GenerateCodeVerifier();
        var codeChallenge = PkceGenerator.DeriveCodeChallenge(codeVerifier);

        dbContext.GoogleOAuthStates.Add(new GoogleOAuthState
        {
            Id = Guid.NewGuid(),
            UserId = membership.UserId,
            StateHash = PkceGenerator.HashState(state),
            CodeVerifier = codeVerifier,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddMinutes(10),
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var authorizationUrl = oAuthClient.BuildAuthorizationUrl(state, codeChallenge, options.RedirectUri);

        return Results.Ok(new GoogleAuthorizationUrlResponse(authorizationUrl));
    }

    private static async Task<IResult> CallbackAsync(
        string? code,
        string? state,
        PlannerDbContext dbContext,
        IGoogleOAuthClient oAuthClient,
        ITokenCipher tokenCipher,
        IOptions<GoogleOptions> googleOptions,
        CancellationToken cancellationToken)
    {
        var options = googleOptions.Value;
        if (!options.IsConfigured)
        {
            return Results.NotFound();
        }

        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
        {
            return RedirectWithError(options, "invalid_request");
        }

        var now = DateTimeOffset.UtcNow;
        var stateHash = PkceGenerator.HashState(state);

        var stateRow = await dbContext.GoogleOAuthStates
            .FirstOrDefaultAsync(x => x.StateHash == stateHash, cancellationToken);

        if (stateRow is null || stateRow.ConsumedAtUtc is not null)
        {
            return RedirectWithError(options, "invalid_state");
        }

        if (stateRow.ExpiresAtUtc < now)
        {
            return RedirectWithError(options, "expired_state");
        }

        stateRow.ConsumedAtUtc = now;
        await dbContext.SaveChangesAsync(cancellationToken);

        GoogleTokenResponse tokenResponse;
        try
        {
            tokenResponse = await oAuthClient.ExchangeCodeAsync(code, stateRow.CodeVerifier, options.RedirectUri, cancellationToken);
        }
        catch (Exception)
        {
            return RedirectWithError(options, "token_exchange_failed");
        }

        string email;
        string subject;
        try
        {
            var idToken = new JwtSecurityTokenHandler().ReadJwtToken(tokenResponse.IdToken);
            email = idToken.Claims.FirstOrDefault(x => x.Type == "email")?.Value
                ?? throw new InvalidOperationException("id_token missing email claim.");
            subject = idToken.Claims.FirstOrDefault(x => x.Type == "sub")?.Value
                ?? throw new InvalidOperationException("id_token missing sub claim.");
        }
        catch (Exception)
        {
            return RedirectWithError(options, "missing_identity");
        }

        var membership = await dbContext.FamilyMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == stateRow.UserId, cancellationToken);

        if (membership is null)
        {
            return RedirectWithError(options, "membership_not_found");
        }

        var connection = await dbContext.GoogleCalendarConnections
            .Include(x => x.Subscriptions)
            .FirstOrDefaultAsync(x => x.UserId == stateRow.UserId, cancellationToken);

        if (connection is null)
        {
            connection = new GoogleCalendarConnection
            {
                Id = Guid.NewGuid(),
                UserId = stateRow.UserId,
                FamilyId = membership.FamilyId,
            };
            dbContext.GoogleCalendarConnections.Add(connection);
        }
        else if (connection.GoogleAccountSubject != subject)
        {
            // Reconnecting under a different Google account: the old subscriptions belong to
            // an account we can no longer read and would 404 forever, so drop them and let the
            // calendar list be reseeded from scratch (primary-only seeding lands with the
            // calendar-listing endpoints).
            dbContext.GoogleCalendarSubscriptions.RemoveRange(connection.Subscriptions);
        }

        connection.GoogleAccountEmail = email;
        connection.GoogleAccountSubject = subject;
        connection.GrantedScopes = tokenResponse.Scope ?? string.Empty;
        connection.Status = GoogleConnectionStatus.Connected;
        connection.ConnectedAtUtc = now;
        connection.LastErrorAtUtc = null;
        connection.LastError = null;

        GoogleRefreshTokenWriter.UpdateRefreshToken(connection, tokenResponse.RefreshToken, tokenCipher);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Most likely two concurrent callbacks for the same user both took the first-connect
            // branch and raced on the unique index over UserId; ask the user to retry rather than
            // surfacing a raw 500.
            return RedirectWithError(options, "connection_conflict");
        }

        return Results.Redirect(QueryHelpers.AddQueryString(options.PostConnectRedirectUrl, "googleCalendar", "connected"));
    }

    private static async Task<IResult> DisconnectAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        IGoogleOAuthClient oAuthClient,
        ITokenCipher tokenCipher,
        IOptions<GoogleOptions> googleOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger(nameof(GoogleIntegrationEndpoints));

        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        if (!googleOptions.Value.IsConfigured)
        {
            return Results.NotFound();
        }

        var connection = await dbContext.GoogleCalendarConnections
            .FirstOrDefaultAsync(x => x.UserId == membership.UserId, cancellationToken);

        if (connection is null)
        {
            return Results.NotFound();
        }

        await GoogleConnectionCleanup.TryRevokeAsync(connection, oAuthClient, tokenCipher, logger, cancellationToken);

        dbContext.GoogleCalendarConnections.Remove(connection);

        var preference = await dbContext.UserCalendarPreferences
            .FirstOrDefaultAsync(x => x.UserId == membership.UserId, cancellationToken);
        if (preference is not null)
        {
            preference.Sources = CalendarSourceSelection.Local;
            preference.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }

    private static IResult RedirectWithError(GoogleOptions options, string reason)
    {
        var url = QueryHelpers.AddQueryString(
            options.PostConnectRedirectUrl,
            new Dictionary<string, string?> { ["googleCalendar"] = "error", ["reason"] = reason });
        return Results.Redirect(url);
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
