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

        authenticated.MapGet("/calendars", GetCalendarsAsync)
            .Produces<GoogleCalendarListResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        authenticated.MapPut("/calendars", UpdateCalendarSelectionAsync)
            .Produces<GoogleCalendarListResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
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
        IGoogleCalendarSubscriptionService subscriptionService,
        IOptions<GoogleOptions> googleOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger(nameof(GoogleIntegrationEndpoints));
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

        var connection = await GetConnectionWithSubscriptionsAsync(stateRow.UserId, dbContext, cancellationToken);

        // First connect and a different-account reconnect both start from zero subscriptions, so
        // both get primary-only seeding below; a same-account reconnect preserves IsSelected as-is.
        var seedPrimaryOnly = connection is null || connection.GoogleAccountSubject != subject;

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
        else if (seedPrimaryOnly)
        {
            // Reconnecting under a different Google account: the old subscriptions belong to
            // an account we can no longer read and would 404 forever, so drop them and reseed
            // from scratch below.
            dbContext.GoogleCalendarSubscriptions.RemoveRange(connection.Subscriptions);
            connection.Subscriptions.Clear();
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
            await subscriptionService.ReconcileAsync(connection, tokenResponse.AccessToken, cancellationToken);

            if (seedPrimaryOnly)
            {
                foreach (var subscription in connection.Subscriptions)
                {
                    subscription.IsSelected = subscription.IsPrimary;
                }
            }
        }
        catch (Exception exception)
        {
            // The connection itself is still good; the user can retry from Family settings via
            // "Refresh list" rather than losing the whole connect over a transient Google error.
            logger.LogWarning(
                exception, "Failed to reconcile Google calendars for connection {ConnectionId} during connect.", connection.Id);
        }

        // Runs regardless of whether reconciliation above succeeded, so it reflects reality either
        // way - including the different-account case where the old subscriptions were already
        // cleared and a failed reconcile would otherwise leave the preference pointed at Both/Google
        // with nothing selected.
        await SyncPreferenceWithSelectionAsync(dbContext, connection, cancellationToken);

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

        var logger = loggerFactory.CreateLogger(nameof(GoogleIntegrationEndpoints));
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

    private static async Task<IResult> GetCalendarsAsync(
        HttpContext httpContext,
        bool? refresh,
        PlannerDbContext dbContext,
        IGoogleAccessTokenProvider accessTokenProvider,
        IGoogleCalendarSubscriptionService subscriptionService,
        IOptions<GoogleOptions> googleOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        if (!googleOptions.Value.IsConfigured)
        {
            return Results.NotFound();
        }

        var connection = await GetConnectionWithSubscriptionsAsync(membership.UserId, dbContext, cancellationToken);
        if (connection is null)
        {
            return Results.NotFound();
        }

        if (refresh == true)
        {
            var logger = loggerFactory.CreateLogger(nameof(GoogleIntegrationEndpoints));

            // A connection that has never synced (e.g. the initial connect's reconcile failed -
            // see CallbackAsync) still needs primary-only seeding the first time this succeeds,
            // exactly like a first connect would have gotten.
            var seedPrimaryOnly = connection.CalendarsSyncedAtUtc is null;

            var accessToken = await accessTokenProvider.GetAccessTokenAsync(connection, cancellationToken);
            if (accessToken is not null)
            {
                try
                {
                    await subscriptionService.ReconcileAsync(connection, accessToken, cancellationToken);

                    if (seedPrimaryOnly)
                    {
                        foreach (var subscription in connection.Subscriptions)
                        {
                            subscription.IsSelected = subscription.IsPrimary;
                        }
                    }
                }
                catch (Exception exception)
                {
                    // Fall back to whatever is cached rather than failing the whole request over
                    // a transient Google error - matches CallbackAsync's tolerance for the same call.
                    logger.LogWarning(
                        exception, "Failed to reconcile Google calendars for connection {ConnectionId}.", connection.Id);
                }
            }

            await SyncPreferenceWithSelectionAsync(dbContext, connection, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Results.Ok(ToListResponse(connection));
    }

    private static async Task<IResult> UpdateCalendarSelectionAsync(
        HttpContext httpContext,
        UpdateGoogleCalendarSelectionRequest request,
        PlannerDbContext dbContext,
        IOptions<GoogleOptions> googleOptions,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        if (!googleOptions.Value.IsConfigured)
        {
            return Results.NotFound();
        }

        var connection = await GetConnectionWithSubscriptionsAsync(membership.UserId, dbContext, cancellationToken);
        if (connection is null)
        {
            return Results.NotFound();
        }

        var requestedIds = (request.SelectedCalendarIds ?? []).ToHashSet();
        var knownIds = connection.Subscriptions.Select(x => x.GoogleCalendarId).ToHashSet();

        if (!requestedIds.IsSubsetOf(knownIds))
        {
            return Results.BadRequest(new { message = "One or more calendar ids do not belong to this connection." });
        }

        if (requestedIds.Count == 0)
        {
            // Unlike a reconciliation-driven drop to zero (GetCalendarsAsync/CallbackAsync, which
            // downgrade the preference instead - there's no user action to reject there), this is
            // a direct user request, so give them the chance to reconsider rather than silently
            // switching them back to Local.
            var preference = await dbContext.UserCalendarPreferences
                .FirstOrDefaultAsync(x => x.UserId == membership.UserId, cancellationToken);
            if (preference is not null && preference.Sources != CalendarSourceSelection.Local)
            {
                return Results.BadRequest(new { message = "Select at least one Google calendar while Google sources are enabled." });
            }
        }

        foreach (var subscription in connection.Subscriptions)
        {
            subscription.IsSelected = requestedIds.Contains(subscription.GoogleCalendarId);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToListResponse(connection));
    }

    private static async Task SyncPreferenceWithSelectionAsync(
        PlannerDbContext dbContext, GoogleCalendarConnection connection, CancellationToken cancellationToken)
    {
        var hasSelection = connection.Subscriptions.Any(x => x.IsSelected);
        var preference = await dbContext.UserCalendarPreferences
            .FirstOrDefaultAsync(x => x.UserId == connection.UserId, cancellationToken);
        var now = DateTimeOffset.UtcNow;

        if (hasSelection)
        {
            if (preference is null)
            {
                dbContext.UserCalendarPreferences.Add(new UserCalendarPreference
                {
                    Id = Guid.NewGuid(),
                    UserId = connection.UserId,
                    FamilyId = connection.FamilyId,
                    Sources = CalendarSourceSelection.Both,
                    UpdatedAtUtc = now,
                });
            }
            else if (preference.Sources == CalendarSourceSelection.Local)
            {
                preference.Sources = CalendarSourceSelection.Both;
                preference.UpdatedAtUtc = now;
            }
        }
        else if (preference is not null && preference.Sources != CalendarSourceSelection.Local)
        {
            // A background reconciliation (connect, or a "Refresh list" call) can legitimately
            // drop the selection to zero - e.g. the only selected calendar was deleted or
            // unshared at Google. There is no user action to reject here (contrast
            // UpdateCalendarSelectionAsync's explicit-PUT case), so downgrade rather than leaving
            // the preference pointed at a source with nothing behind it.
            preference.Sources = CalendarSourceSelection.Local;
            preference.UpdatedAtUtc = now;
        }
    }

    private static Task<GoogleCalendarConnection?> GetConnectionWithSubscriptionsAsync(
        string userId, PlannerDbContext dbContext, CancellationToken cancellationToken)
    {
        return dbContext.GoogleCalendarConnections
            .Include(x => x.Subscriptions)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
    }

    private static GoogleCalendarListResponse ToListResponse(GoogleCalendarConnection connection)
    {
        var calendars = connection.Subscriptions
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.Summary, StringComparer.OrdinalIgnoreCase)
            .Select(x => new GoogleCalendarSummary(
                x.GoogleCalendarId, x.Summary, x.ColorHex, x.AccessRole, x.IsPrimary, x.IsSelected))
            .ToArray();

        return new GoogleCalendarListResponse(calendars, connection.CalendarsSyncedAtUtc);
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
