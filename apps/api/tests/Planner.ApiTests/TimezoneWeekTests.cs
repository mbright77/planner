using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Planner.Contracts.Auth;
using Planner.Contracts.Calendar;
using Planner.Contracts.Dashboard;
using Planner.Contracts.Meals;

namespace Planner.ApiTests;

public sealed class TimezoneWeekTests(ApiTestFactory factory) : IClassFixture<ApiTestFactory>
{
    [Fact]
    public async Task Dashboard_overview_uses_family_timezone_for_day_and_week_boundaries()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var email = $"tzdash-{Guid.NewGuid():N}@planner.test";

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            new RegisterRequest(email, "Planner123!", "TZ Dashboard Family", "Alex", "America/Los_Angeles", "green")
        );
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        // 19:00 local time on a chosen local date is 02:00 UTC on the *next* calendar date.
        // A handler that stamps DateTimeKind.Utc directly onto the local date (rather than
        // converting through the family's timezone) will put this event in the wrong day.
        var localDate = new DateOnly(2026, 3, 10);

        var calendarResponse = await client.PostAsJsonAsync(
            "/api/v1/calendar",
            new CreateCalendarEventRequest(
                "Late Local Evening",
                null,
                localDate,
                new TimeOnly(19, 0),
                new TimeOnly(20, 0),
                null,
                false,
                null));
        Assert.Equal(HttpStatusCode.Created, calendarResponse.StatusCode);

        var dashboard = await client.GetFromJsonAsync<DashboardOverviewResponse>(
            $"/api/v1/dashboard/overview?date={localDate:yyyy-MM-dd}");
        Assert.NotNull(dashboard);

        Assert.Contains(dashboard.TodayEvents, x => x.Title == "Late Local Evening");

        var daySummary = Assert.Single(dashboard.Week, x => x.Date == localDate);
        Assert.Equal(1, daySummary.EventCount);

        var nextDaySummary = dashboard.Week.SingleOrDefault(x => x.Date == localDate.AddDays(1));
        if (nextDaySummary is not null)
        {
            Assert.Equal(0, nextDaySummary.EventCount);
        }
    }

    [Fact]
    public async Task Meals_week_without_start_uses_family_timezone()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var email = $"tztest-{Guid.NewGuid():N}@planner.test";

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            new RegisterRequest(email, "Planner123!", "TZ Family", "Alex", "America/Los_Angeles", "green")
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var weekResponse = await client.GetFromJsonAsync<WeeklyMealsResponse>("/api/v1/meals/week");
        Assert.NotNull(weekResponse);

        var tz = TimeZoneInfo.FindSystemTimeZoneById("America/Los_Angeles");
        var familyNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);
        var target = DateOnly.FromDateTime(familyNow.DateTime);
        var diff = target.DayOfWeek == DayOfWeek.Sunday ? -6 : DayOfWeek.Monday - target.DayOfWeek;
        var expectedWeekStart = target.AddDays(diff);

        Assert.Equal(expectedWeekStart, weekResponse.WeekStart);
    }
}
