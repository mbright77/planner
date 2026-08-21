using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Planner.Contracts.Auth;
using Planner.Contracts.Bootstrap;
using Planner.Contracts.Integrations;
using Planner.Domain;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Persistence;
using Planner.Infrastructure.Security;

namespace Planner.ApiTests;

public sealed class GoogleCalendarApiTests(GoogleConfiguredApiTestFactory factory)
    : IClassFixture<GoogleConfiguredApiTestFactory>
{
    [Fact]
    public async Task Get_calendars_without_a_connection_returns_404()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var response = await client.GetAsync("/api/v1/integrations/google/calendars");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Get_calendars_returns_the_cached_list_mapped_to_display_names()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, [
            ("primary@group.calendar.google.com", "Primary", true, true),
            ("shared@group.calendar.google.com", "Shared Work", false, false),
        ]);

        var response = await client.GetFromJsonAsync<GoogleCalendarListResponse>("/api/v1/integrations/google/calendars");

        Assert.NotNull(response);
        Assert.Equal(2, response.Calendars.Count);
        var primary = Assert.Single(response.Calendars, x => x.GoogleCalendarId == "primary@group.calendar.google.com");
        Assert.Equal("Primary", primary.DisplayName);
        Assert.True(primary.IsPrimary);
        Assert.True(primary.IsSelected);
        var shared = Assert.Single(response.Calendars, x => x.GoogleCalendarId == "shared@group.calendar.google.com");
        Assert.False(shared.IsSelected);
    }

    [Fact]
    public async Task Refreshing_the_calendar_list_prunes_a_calendar_google_no_longer_returns()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, [
            ("primary@group.calendar.google.com", "Primary", true, true),
            ("gone@group.calendar.google.com", "Deleted Calendar", false, true),
        ]);

        factory.FakeGoogleOAuthClient.NextRefreshResponse = new GoogleTokenResponse(
            "fresh-access-token", null, 3600, null, "scope");
        factory.FakeGoogleCalendarClient.CalendarsToReturn =
        [
            new GoogleCalendarListEntry("primary@group.calendar.google.com", "Primary", null, null, null, "owner", true),
        ];

        var response = await client.GetFromJsonAsync<GoogleCalendarListResponse>(
            "/api/v1/integrations/google/calendars?refresh=true");

        Assert.NotNull(response);
        var calendar = Assert.Single(response.Calendars);
        Assert.Equal("primary@group.calendar.google.com", calendar.GoogleCalendarId);
        Assert.NotNull(response.CalendarsSyncedAtUtc);
        Assert.Equal(["fresh-access-token"], factory.FakeGoogleCalendarClient.AccessTokensUsed);
    }

    [Fact]
    public async Task Refreshing_survives_a_duplicate_calendar_id_in_the_same_response()
    {
        // Regression test: ReconcileAsync used to build its "already seen" lookup once up front,
        // so a repeated id in the same ListCalendarsAsync result (Google paginates calendarList
        // internally; a duplicate across pages is a real, if rare, possibility) inserted a second
        // row and violated the (ConnectionId, GoogleCalendarId) unique index.
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, []);

        factory.FakeGoogleOAuthClient.NextRefreshResponse = new GoogleTokenResponse(
            "fresh-access-token", null, 3600, null, "scope");
        factory.FakeGoogleCalendarClient.CalendarsToReturn =
        [
            new GoogleCalendarListEntry("dup@group.calendar.google.com", "Duplicate", null, null, null, "owner", true),
            new GoogleCalendarListEntry("dup@group.calendar.google.com", "Duplicate", null, null, null, "owner", true),
        ];

        var response = await client.GetAsync("/api/v1/integrations/google/calendars?refresh=true");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<GoogleCalendarListResponse>();
        Assert.NotNull(body);
        Assert.Single(body.Calendars);
    }

    [Fact]
    public async Task Refreshing_to_zero_selected_calendars_downgrades_an_active_google_preference_to_local()
    {
        // Regression test: a background reconciliation (as opposed to an explicit PUT) that drops
        // the selection to zero used to leave preference.Sources pointed at Both/Google with
        // nothing behind it - and PUT /calendars would then reject any attempt to fix that, since
        // both an empty selection (already active) and any known id (none left) were rejected.
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, [
            ("primary@group.calendar.google.com", "Primary", true, true),
        ]);
        await SeedPreferenceAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, CalendarSourceSelection.Both);

        factory.FakeGoogleOAuthClient.NextRefreshResponse = new GoogleTokenResponse(
            "fresh-access-token", null, 3600, null, "scope");
        factory.FakeGoogleCalendarClient.CalendarsToReturn = [];

        var response = await client.GetAsync("/api/v1/integrations/google/calendars?refresh=true");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        var preference = await dbContext.UserCalendarPreferences.SingleAsync(x => x.UserId == bootstrap.Membership.UserId);
        Assert.Equal(CalendarSourceSelection.Local, preference.Sources);
    }

    [Fact]
    public async Task Get_calendars_when_google_is_unconfigured_returns_404()
    {
        await using var unconfiguredFactory = new ApiTestFactory();
        await unconfiguredFactory.ResetDatabaseAsync();
        using var client = unconfiguredFactory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var response = await client.GetAsync("/api/v1/integrations/google/calendars");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Refreshing_with_an_expired_grant_marks_the_connection_needs_reauth_but_still_returns_the_cached_list()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, [
            ("primary@group.calendar.google.com", "Primary", true, true),
        ]);

        factory.FakeGoogleOAuthClient.NextRefreshException = new InvalidOperationException("invalid_grant");

        var response = await client.GetAsync("/api/v1/integrations/google/calendars?refresh=true");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<GoogleCalendarListResponse>();
        Assert.NotNull(body);
        Assert.Single(body.Calendars);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        var connection = await dbContext.GoogleCalendarConnections.SingleAsync(x => x.UserId == bootstrap.Membership.UserId);
        Assert.Equal(GoogleConnectionStatus.NeedsReauth, connection.Status);
    }

    [Fact]
    public async Task Put_calendars_replaces_the_selected_set()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, [
            ("primary@group.calendar.google.com", "Primary", true, true),
            ("shared@group.calendar.google.com", "Shared Work", false, false),
        ]);

        var response = await client.PutAsJsonAsync(
            "/api/v1/integrations/google/calendars",
            new UpdateGoogleCalendarSelectionRequest(["shared@group.calendar.google.com"]));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<GoogleCalendarListResponse>();
        Assert.NotNull(body);
        Assert.False(Assert.Single(body.Calendars, x => x.GoogleCalendarId == "primary@group.calendar.google.com").IsSelected);
        Assert.True(Assert.Single(body.Calendars, x => x.GoogleCalendarId == "shared@group.calendar.google.com").IsSelected);
    }

    [Fact]
    public async Task Put_calendars_with_an_id_not_belonging_to_the_connection_returns_400_and_leaves_selection_unchanged()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, [
            ("primary@group.calendar.google.com", "Primary", true, true),
        ]);

        var response = await client.PutAsJsonAsync(
            "/api/v1/integrations/google/calendars",
            new UpdateGoogleCalendarSelectionRequest(["not-a-real-calendar-id"]));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
        var subscription = await dbContext.GoogleCalendarSubscriptions
            .SingleAsync(x => x.GoogleCalendarId == "primary@group.calendar.google.com");
        Assert.True(subscription.IsSelected);
    }

    [Fact]
    public async Task Put_calendars_deselecting_everything_while_google_sources_are_enabled_returns_400()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, [
            ("primary@group.calendar.google.com", "Primary", true, true),
        ]);
        await SeedPreferenceAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, CalendarSourceSelection.Both);

        var response = await client.PutAsJsonAsync(
            "/api/v1/integrations/google/calendars", new UpdateGoogleCalendarSelectionRequest([]));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Put_calendars_deselecting_everything_while_preference_is_local_succeeds()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();
        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, [
            ("primary@group.calendar.google.com", "Primary", true, true),
        ]);

        var response = await client.PutAsJsonAsync(
            "/api/v1/integrations/google/calendars", new UpdateGoogleCalendarSelectionRequest([]));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task SeedConnectionAsync(
        string userId, Guid familyId, (string GoogleCalendarId, string Summary, bool IsPrimary, bool IsSelected)[] calendars)
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
            GoogleAccountSubject = "subject-1",
            RefreshTokenCipher = encryptedRefreshToken.Cipher,
            RefreshTokenNonce = encryptedRefreshToken.Nonce,
            RefreshTokenTag = encryptedRefreshToken.Tag,
            KeyVersion = encryptedRefreshToken.KeyVersion,
            GrantedScopes = "calendar.events.readonly",
            Status = GoogleConnectionStatus.Connected,
            ConnectedAtUtc = DateTimeOffset.UtcNow,
        };
        dbContext.GoogleCalendarConnections.Add(connection);

        foreach (var calendar in calendars)
        {
            dbContext.GoogleCalendarSubscriptions.Add(new GoogleCalendarSubscription
            {
                Id = Guid.NewGuid(),
                ConnectionId = connection.Id,
                GoogleCalendarId = calendar.GoogleCalendarId,
                Summary = calendar.Summary,
                AccessRole = "owner",
                IsPrimary = calendar.IsPrimary,
                IsSelected = calendar.IsSelected,
                LastSeenAtUtc = DateTimeOffset.UtcNow,
            });
        }

        await dbContext.SaveChangesAsync();
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

    private static async Task<AuthResponse> RegisterAsync(HttpClient client)
    {
        var email = $"gcal-{Guid.NewGuid():N}@planner.test";

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            new RegisterRequest(email, "Planner123!", "Google Calendar Family", "Alex", "UTC", "green"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authResponse);

        return authResponse;
    }
}
