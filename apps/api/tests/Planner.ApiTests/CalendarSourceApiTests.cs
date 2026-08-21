using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Planner.Contracts.Auth;
using Planner.Contracts.Bootstrap;
using Planner.Contracts.Dashboard;
using Planner.Contracts.Integrations;
using Planner.Domain;
using Planner.Infrastructure.Persistence;

namespace Planner.ApiTests;

public sealed class CalendarSourceApiTests(ApiTestFactory factory) : IClassFixture<ApiTestFactory>
{
    [Fact]
    public async Task Default_preference_is_local_and_dashboard_reports_it_unconfigured()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var settings = await client.GetFromJsonAsync<CalendarSourceSettingsResponse>("/api/v1/calendar/sources");
        Assert.NotNull(settings);
        Assert.Equal("Local", settings.Sources);
        Assert.False(settings.IsGoogleConfigured);
        Assert.Null(settings.Connection);

        var dashboard = await client.GetFromJsonAsync<DashboardOverviewResponse>("/api/v1/dashboard/overview");
        Assert.NotNull(dashboard);
        Assert.Equal("Local", dashboard.Sources.Preference);
        Assert.Equal("NotConfigured", dashboard.Sources.Google.Status);
    }

    [Fact]
    public async Task Put_sources_to_google_without_a_connection_returns_400_and_leaves_preference_unchanged()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var response = await client.PutAsJsonAsync(
            "/api/v1/calendar/sources", new UpdateCalendarSourcesRequest("Google"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var settings = await client.GetFromJsonAsync<CalendarSourceSettingsResponse>("/api/v1/calendar/sources");
        Assert.NotNull(settings);
        Assert.Equal("Local", settings.Sources);
    }

    [Fact]
    public async Task Put_sources_to_google_with_connection_but_zero_selected_calendars_returns_400()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedGoogleConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, selectedCalendarCount: 0);

        var response = await client.PutAsJsonAsync(
            "/api/v1/calendar/sources", new UpdateCalendarSourcesRequest("Both"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var settings = await client.GetFromJsonAsync<CalendarSourceSettingsResponse>("/api/v1/calendar/sources");
        Assert.NotNull(settings);
        Assert.Equal("Local", settings.Sources);
    }

    [Fact]
    public async Task Put_sources_to_both_succeeds_when_connected_with_a_selected_calendar()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        await SeedGoogleConnectionAsync(bootstrap.Membership.UserId, bootstrap.FamilyId, selectedCalendarCount: 1);

        var response = await client.PutAsJsonAsync(
            "/api/v1/calendar/sources", new UpdateCalendarSourcesRequest("Both"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var settings = await response.Content.ReadFromJsonAsync<CalendarSourceSettingsResponse>();
        Assert.NotNull(settings);
        Assert.Equal("Both", settings.Sources);
        Assert.NotNull(settings.Connection);
        Assert.Equal(1, settings.Connection.SelectedCalendarCount);

        var dashboard = await client.GetFromJsonAsync<DashboardOverviewResponse>("/api/v1/dashboard/overview");
        Assert.NotNull(dashboard);
        Assert.Equal("Both", dashboard.Sources.Preference);
        // ApiTestFactory does not configure Google OAuth, so token decryption fails -> NeedsReauth
        // (DashboardEndpoints now loads Subscriptions, triggering actual event fetch attempt)
        Assert.Equal("NeedsReauth", dashboard.Sources.Google.Status);
    }

    [Fact]
    public async Task Put_sources_with_an_unrecognised_value_returns_400()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var auth = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var response = await client.PutAsJsonAsync(
            "/api/v1/calendar/sources", new UpdateCalendarSourcesRequest("Bogus"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task SeedGoogleConnectionAsync(string userId, Guid familyId, int selectedCalendarCount)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();

        var connection = new GoogleCalendarConnection
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FamilyId = familyId,
            GoogleAccountEmail = "family@example.com",
            GoogleAccountSubject = "google-subject-1",
            RefreshTokenCipher = [1, 2, 3],
            RefreshTokenNonce = [4, 5, 6],
            RefreshTokenTag = [7, 8, 9],
            KeyVersion = 1,
            GrantedScopes = "calendar.events.readonly calendar.calendarlist.readonly",
            Status = GoogleConnectionStatus.Connected,
            ConnectedAtUtc = DateTimeOffset.UtcNow,
        };

        dbContext.GoogleCalendarConnections.Add(connection);

        for (var i = 0; i < selectedCalendarCount; i++)
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
    }

    private static async Task<AuthResponse> RegisterAsync(HttpClient client)
    {
        var email = $"calsrc-{Guid.NewGuid():N}@planner.test";

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            new RegisterRequest(email, "Planner123!", "Calendar Source Family", "Alex", "UTC", "green"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authResponse);

        return authResponse;
    }
}
