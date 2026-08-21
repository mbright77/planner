using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Planner.Contracts.Auth;
using Planner.Contracts.Bootstrap;
using Planner.Contracts.Integrations;
using Planner.Contracts.Invites;
using Planner.Contracts.Privacy;
using Planner.Domain;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Persistence;
using Planner.Infrastructure.Security;

namespace Planner.ApiTests;

public sealed class GoogleIntegrationApiTests(GoogleConfiguredApiTestFactory factory)
    : IClassFixture<GoogleConfiguredApiTestFactory>
{
    [Fact]
    public async Task Authorize_returns_a_url_containing_a_state_backed_by_a_stored_row()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var response = await client.PostAsync("/api/v1/integrations/google/authorize", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<GoogleAuthorizationUrlResponse>();
        Assert.NotNull(body);
        Assert.Contains(Uri.EscapeDataString(GoogleConfiguredApiTestFactory.RedirectUri), body.AuthorizationUrl);

        var state = ExtractQueryParam(body.AuthorizationUrl, "state");
        Assert.False(string.IsNullOrEmpty(state));

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        var stateHash = PkceGenerator.HashState(state!);
        var stored = await dbContext.GoogleOAuthStates.FirstOrDefaultAsync(x => x.StateHash == stateHash);
        Assert.NotNull(stored);
        Assert.Null(stored.ConsumedAtUtc);
    }

    [Fact]
    public async Task Callback_with_an_unknown_state_redirects_with_an_error_and_creates_no_connection()
    {
        await factory.ResetDatabaseAsync();
        using var client = CreateNonRedirectingClient();

        var response = await client.GetAsync("/api/v1/integrations/google/callback?code=abc&state=unknown-state");

        AssertRedirectsWithError(response, "invalid_state");

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        Assert.Empty(await dbContext.GoogleCalendarConnections.ToListAsync());
    }

    [Fact]
    public async Task Callback_with_an_already_consumed_state_is_rejected()
    {
        await factory.ResetDatabaseAsync();
        using var authedClient = factory.CreateClient();
        var auth = await RegisterAsync(authedClient);
        authedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var authorizeResponse = await authedClient.PostAsync("/api/v1/integrations/google/authorize", null);
        var authorizeBody = await authorizeResponse.Content.ReadFromJsonAsync<GoogleAuthorizationUrlResponse>();
        var state = ExtractQueryParam(authorizeBody!.AuthorizationUrl, "state")!;

        factory.FakeGoogleOAuthClient.NextExchangeResponse = new GoogleTokenResponse(
            "access-token", "refresh-token", 3600, BuildIdToken("first@example.com", "subject-1"), "scope");

        using var callbackClient = CreateNonRedirectingClient();
        var firstCallback = await callbackClient.GetAsync($"/api/v1/integrations/google/callback?code=code-1&state={Uri.EscapeDataString(state)}");
        AssertRedirectsWithSuccess(firstCallback);

        var secondCallback = await callbackClient.GetAsync($"/api/v1/integrations/google/callback?code=code-2&state={Uri.EscapeDataString(state)}");
        AssertRedirectsWithError(secondCallback, "invalid_state");
    }

    [Fact]
    public async Task Callback_with_an_expired_state_is_rejected()
    {
        await factory.ResetDatabaseAsync();
        using var authedClient = factory.CreateClient();
        var auth = await RegisterAsync(authedClient);
        authedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var authorizeResponse = await authedClient.PostAsync("/api/v1/integrations/google/authorize", null);
        var authorizeBody = await authorizeResponse.Content.ReadFromJsonAsync<GoogleAuthorizationUrlResponse>();
        var state = ExtractQueryParam(authorizeBody!.AuthorizationUrl, "state")!;

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
            var stateHash = PkceGenerator.HashState(state);
            var row = await dbContext.GoogleOAuthStates.FirstAsync(x => x.StateHash == stateHash);
            row.ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(-1);
            await dbContext.SaveChangesAsync();
        }

        using var callbackClient = CreateNonRedirectingClient();
        var response = await callbackClient.GetAsync($"/api/v1/integrations/google/callback?code=code-1&state={Uri.EscapeDataString(state)}");

        AssertRedirectsWithError(response, "expired_state");
    }

    [Fact]
    public async Task Callback_with_a_valid_state_creates_a_connected_connection()
    {
        await factory.ResetDatabaseAsync();
        using var authedClient = factory.CreateClient();
        var auth = await RegisterAsync(authedClient);
        authedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var bootstrap = await authedClient.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        var authorizeResponse = await authedClient.PostAsync("/api/v1/integrations/google/authorize", null);
        var authorizeBody = await authorizeResponse.Content.ReadFromJsonAsync<GoogleAuthorizationUrlResponse>();
        var state = ExtractQueryParam(authorizeBody!.AuthorizationUrl, "state")!;

        factory.FakeGoogleOAuthClient.NextExchangeResponse = new GoogleTokenResponse(
            "access-token", "refresh-token-value", 3600, BuildIdToken("connected@example.com", "subject-1"), "granted-scope");
        factory.FakeGoogleCalendarClient.CalendarsToReturn =
        [
            new GoogleCalendarListEntry("primary@group.calendar.google.com", "Primary", null, null, null, "owner", true),
            new GoogleCalendarListEntry("holidays@group.calendar.google.com", "Holidays", null, null, null, "reader", false),
        ];

        using var callbackClient = CreateNonRedirectingClient();
        var response = await callbackClient.GetAsync($"/api/v1/integrations/google/callback?code=code-1&state={Uri.EscapeDataString(state)}");

        AssertRedirectsWithSuccess(response);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        var connection = await dbContext.GoogleCalendarConnections
            .Include(x => x.Subscriptions)
            .SingleAsync(x => x.UserId == bootstrap.Membership.UserId);

        Assert.Equal("connected@example.com", connection.GoogleAccountEmail);
        Assert.Equal("subject-1", connection.GoogleAccountSubject);
        Assert.Equal(GoogleConnectionStatus.Connected, connection.Status);
        Assert.Equal(bootstrap.FamilyId, connection.FamilyId);
        Assert.NotEmpty(connection.RefreshTokenCipher);
        Assert.NotNull(connection.CalendarsSyncedAtUtc);

        // First-ever connect seeds the primary calendar only.
        Assert.Equal(2, connection.Subscriptions.Count);
        var primary = Assert.Single(connection.Subscriptions, x => x.GoogleCalendarId == "primary@group.calendar.google.com");
        Assert.True(primary.IsSelected);
        var holidays = Assert.Single(connection.Subscriptions, x => x.GoogleCalendarId == "holidays@group.calendar.google.com");
        Assert.False(holidays.IsSelected);

        // A calendar got selected, so the still-Local preference upgrades to Both.
        var preference = await dbContext.UserCalendarPreferences.SingleAsync(x => x.UserId == bootstrap.Membership.UserId);
        Assert.Equal(CalendarSourceSelection.Both, preference.Sources);
    }

    [Fact]
    public async Task Reconnect_with_the_same_google_account_preserves_subscriptions()
    {
        await factory.ResetDatabaseAsync();
        using var authedClient = factory.CreateClient();
        var auth = await RegisterAsync(authedClient);
        authedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var bootstrap = await authedClient.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        var connectionId = await SeedConnectionAsync(
            bootstrap.Membership.UserId, bootstrap.FamilyId, "subject-1", subscriptionCount: 2);

        var authorizeResponse = await authedClient.PostAsync("/api/v1/integrations/google/authorize", null);
        var authorizeBody = await authorizeResponse.Content.ReadFromJsonAsync<GoogleAuthorizationUrlResponse>();
        var state = ExtractQueryParam(authorizeBody!.AuthorizationUrl, "state")!;

        factory.FakeGoogleOAuthClient.NextExchangeResponse = new GoogleTokenResponse(
            "access-token", "refresh-token", 3600, BuildIdToken("same@example.com", "subject-1"), "scope");
        // Google still reports both calendars on reconnect, so reconciliation must find them by
        // id and preserve IsSelected rather than treating them as newly discovered.
        factory.FakeGoogleCalendarClient.CalendarsToReturn =
        [
            new GoogleCalendarListEntry("calendar-0@group.calendar.google.com", "Calendar 0", null, null, null, "owner", true),
            new GoogleCalendarListEntry("calendar-1@group.calendar.google.com", "Calendar 1", null, null, null, "owner", false),
        ];

        using var callbackClient = CreateNonRedirectingClient();
        var response = await callbackClient.GetAsync($"/api/v1/integrations/google/callback?code=code-1&state={Uri.EscapeDataString(state)}");
        AssertRedirectsWithSuccess(response);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        var subscriptions = await dbContext.GoogleCalendarSubscriptions
            .Where(x => x.ConnectionId == connectionId)
            .ToListAsync();

        Assert.Equal(2, subscriptions.Count);
        Assert.All(subscriptions, x => Assert.True(x.IsSelected));
    }

    [Fact]
    public async Task Reconnect_with_a_different_google_account_discards_old_subscriptions()
    {
        await factory.ResetDatabaseAsync();
        using var authedClient = factory.CreateClient();
        var auth = await RegisterAsync(authedClient);
        authedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var bootstrap = await authedClient.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        var connectionId = await SeedConnectionAsync(
            bootstrap.Membership.UserId, bootstrap.FamilyId, "subject-old", subscriptionCount: 2);

        var authorizeResponse = await authedClient.PostAsync("/api/v1/integrations/google/authorize", null);
        var authorizeBody = await authorizeResponse.Content.ReadFromJsonAsync<GoogleAuthorizationUrlResponse>();
        var state = ExtractQueryParam(authorizeBody!.AuthorizationUrl, "state")!;

        factory.FakeGoogleOAuthClient.NextExchangeResponse = new GoogleTokenResponse(
            "access-token", "refresh-token", 3600, BuildIdToken("different@example.com", "subject-new"), "scope");
        // The new account has its own calendar set, unrelated to the old one's ids.
        factory.FakeGoogleCalendarClient.CalendarsToReturn =
        [
            new GoogleCalendarListEntry("new-primary@group.calendar.google.com", "New Primary", null, null, null, "owner", true),
            new GoogleCalendarListEntry("new-secondary@group.calendar.google.com", "New Secondary", null, null, null, "reader", false),
        ];

        using var callbackClient = CreateNonRedirectingClient();
        var response = await callbackClient.GetAsync($"/api/v1/integrations/google/callback?code=code-1&state={Uri.EscapeDataString(state)}");
        AssertRedirectsWithSuccess(response);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        var subscriptions = await dbContext.GoogleCalendarSubscriptions
            .Where(x => x.ConnectionId == connectionId)
            .ToListAsync();
        var connection = await dbContext.GoogleCalendarConnections.SingleAsync(x => x.Id == connectionId);

        Assert.Equal("subject-new", connection.GoogleAccountSubject);
        Assert.Equal("different@example.com", connection.GoogleAccountEmail);

        // Old subscriptions (calendar-0/calendar-1) are gone, and the new account's calendars
        // were reseeded primary-only, exactly like a first connect.
        Assert.Equal(2, subscriptions.Count);
        Assert.DoesNotContain(subscriptions, x => x.GoogleCalendarId.StartsWith("calendar-", StringComparison.Ordinal));
        var newPrimary = Assert.Single(subscriptions, x => x.GoogleCalendarId == "new-primary@group.calendar.google.com");
        Assert.True(newPrimary.IsSelected);
        var newSecondary = Assert.Single(subscriptions, x => x.GoogleCalendarId == "new-secondary@group.calendar.google.com");
        Assert.False(newSecondary.IsSelected);
    }

    [Fact]
    public async Task Disconnect_removes_the_connection_revokes_and_resets_preference_to_local()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, "subject-1", subscriptionCount: 1);
        await SeedPreferenceAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, CalendarSourceSelection.Both);

        var response = await client.PostAsync("/api/v1/integrations/google/disconnect", null);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        Assert.Single(factory.FakeGoogleOAuthClient.RevokedTokens);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        Assert.Empty(await dbContext.GoogleCalendarConnections.Where(x => x.UserId == bootstrap.Membership.UserId).ToListAsync());
        Assert.Empty(await dbContext.GoogleCalendarSubscriptions.ToListAsync());

        var preference = await dbContext.UserCalendarPreferences.SingleAsync(x => x.UserId == bootstrap.Membership.UserId);
        Assert.Equal(CalendarSourceSelection.Local, preference.Sources);
    }

    [Fact]
    public async Task Disconnect_without_a_connection_returns_404()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var response = await client.PostAsync("/api/v1/integrations/google/disconnect", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Account_deletion_removes_the_google_connection_preference_and_oauth_states()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);
        var userId = bootstrap.Membership.UserId;

        await SeedConnectionAsync(userId, bootstrap.FamilyId, "subject-1", subscriptionCount: 1);
        await SeedPreferenceAsync(userId, bootstrap.FamilyId, CalendarSourceSelection.Both);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
            dbContext.GoogleOAuthStates.Add(new GoogleOAuthState
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                StateHash = PkceGenerator.HashState("leftover-state"),
                CodeVerifier = "leftover-verifier",
                CreatedAtUtc = DateTimeOffset.UtcNow,
                ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(10),
            });
            await dbContext.SaveChangesAsync();
        }

        // Account deletion requires the family to have another member.
        var inviteResponse = await client.PostAsJsonAsync(
            "/api/v1/family-invites", new CreateFamilyInviteRequest("adult@example.com", null));
        Assert.Equal(HttpStatusCode.Created, inviteResponse.StatusCode);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<FamilyInviteResponse>();
        Assert.NotNull(invite);

        var acceptResponse = await client.PostAsJsonAsync(
            $"/api/v1/invites/{invite.Token}/accept",
            new AcceptFamilyInviteRequest("adult@example.com", "Planner123!", "Taylor", "blue"));
        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);

        var deleteResponse = await client.PostAsJsonAsync(
            "/api/v1/privacy/account/delete", new DeleteAccountRequest("Planner123!"));
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDbContext = verifyScope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        Assert.Empty(await verifyDbContext.GoogleCalendarConnections.Where(x => x.UserId == userId).ToListAsync());
        Assert.Empty(await verifyDbContext.UserCalendarPreferences.Where(x => x.UserId == userId).ToListAsync());
        Assert.Empty(await verifyDbContext.GoogleOAuthStates.Where(x => x.UserId == userId).ToListAsync());
    }

    [Fact]
    public async Task Family_deletion_revokes_and_removes_google_data_for_every_member()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);
        var userId = bootstrap.Membership.UserId;

        await SeedConnectionAsync(userId, bootstrap.FamilyId, "subject-1", subscriptionCount: 1);
        await SeedPreferenceAsync(userId, bootstrap.FamilyId, CalendarSourceSelection.Both);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
            dbContext.GoogleOAuthStates.Add(new GoogleOAuthState
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                StateHash = PkceGenerator.HashState("leftover-state"),
                CodeVerifier = "leftover-verifier",
                CreatedAtUtc = DateTimeOffset.UtcNow,
                ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(10),
            });
            await dbContext.SaveChangesAsync();
        }

        var deleteResponse = await client.PostAsJsonAsync(
            "/api/v1/privacy/family/delete", new DeleteFamilyRequest("Planner123!"));
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

        Assert.Single(factory.FakeGoogleOAuthClient.RevokedTokens);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDbContext = verifyScope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        Assert.Empty(await verifyDbContext.GoogleCalendarConnections.Where(x => x.UserId == userId).ToListAsync());
        Assert.Empty(await verifyDbContext.UserCalendarPreferences.Where(x => x.UserId == userId).ToListAsync());
        Assert.Empty(await verifyDbContext.GoogleOAuthStates.Where(x => x.UserId == userId).ToListAsync());
    }

    private async Task<Guid> SeedConnectionAsync(string userId, Guid familyId, string googleAccountSubject, int subscriptionCount)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        var tokenCipher = scope.ServiceProvider.GetRequiredService<ITokenCipher>();
        var encryptedRefreshToken = tokenCipher.Encrypt("seeded-refresh-token");

        var connection = new GoogleCalendarConnection
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FamilyId = familyId,
            GoogleAccountEmail = "existing@example.com",
            GoogleAccountSubject = googleAccountSubject,
            RefreshTokenCipher = encryptedRefreshToken.Cipher,
            RefreshTokenNonce = encryptedRefreshToken.Nonce,
            RefreshTokenTag = encryptedRefreshToken.Tag,
            KeyVersion = encryptedRefreshToken.KeyVersion,
            GrantedScopes = "calendar.events.readonly",
            Status = GoogleConnectionStatus.Connected,
            ConnectedAtUtc = DateTimeOffset.UtcNow,
        };
        dbContext.GoogleCalendarConnections.Add(connection);

        for (var i = 0; i < subscriptionCount; i++)
        {
            dbContext.GoogleCalendarSubscriptions.Add(new GoogleCalendarSubscription
            {
                Id = Guid.NewGuid(),
                ConnectionId = connection.Id,
                GoogleCalendarId = $"calendar-{i}@group.calendar.google.com",
                Summary = $"Calendar {i}",
                AccessRole = "owner",
                IsPrimary = i == 0,
                IsSelected = true,
                LastSeenAtUtc = DateTimeOffset.UtcNow,
            });
        }

        await dbContext.SaveChangesAsync();
        return connection.Id;
    }

    private async Task SeedPreferenceAsync(string userId, Guid familyId, CalendarSourceSelection sources)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();

        dbContext.UserCalendarPreferences.Add(new UserCalendarPreference
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FamilyId = familyId,
            Sources = sources,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });

        await dbContext.SaveChangesAsync();
    }

    private HttpClient CreateNonRedirectingClient()
    {
        return factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
    }

    private static void AssertRedirectsWithSuccess(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!.ToString();
        Assert.StartsWith(GoogleConfiguredApiTestFactory.PostConnectRedirectUrl, location);
        Assert.Contains("googleCalendar=connected", location);
    }

    private static void AssertRedirectsWithError(HttpResponseMessage response, string expectedReason)
    {
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!.ToString();
        Assert.StartsWith(GoogleConfiguredApiTestFactory.PostConnectRedirectUrl, location);
        Assert.Contains("googleCalendar=error", location);
        Assert.Contains($"reason={expectedReason}", location);
    }

    private static string? ExtractQueryParam(string url, string name)
    {
        var marker = $"{name}=";
        var index = url.IndexOf(marker, StringComparison.Ordinal);
        if (index < 0)
        {
            return null;
        }

        var start = index + marker.Length;
        var end = url.IndexOf('&', start);
        var raw = end < 0 ? url[start..] : url[start..end];
        return Uri.UnescapeDataString(raw);
    }

    private static string BuildIdToken(string email, string subject)
    {
        var claims = new List<Claim>
        {
            new("email", email),
            new("sub", subject),
        };

        var token = new JwtSecurityToken(issuer: "https://accounts.google.com", claims: claims);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static async Task<AuthResponse> RegisterAsync(HttpClient client)
    {
        var email = $"gauth-{Guid.NewGuid():N}@planner.test";

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            new RegisterRequest(email, "Planner123!", "Google OAuth Family", "Alex", "UTC", "green"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authResponse);

        return authResponse;
    }
}
