using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Planner.Contracts.Auth;
using Planner.Contracts.Meals;

namespace Planner.ApiTests;

public sealed class TimezoneWeekTests(ApiTestFactory factory) : IClassFixture<ApiTestFactory>
{
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
