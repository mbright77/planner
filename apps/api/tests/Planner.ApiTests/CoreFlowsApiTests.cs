using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Planner.Contracts.Auth;
using Planner.Contracts.Bootstrap;
using Planner.Contracts.Calendar;
using Planner.Contracts.Dashboard;
using Planner.Contracts.Meals;
using Planner.Contracts.Profiles;
using Planner.Contracts.Shopping;

namespace Planner.ApiTests;

public sealed class CoreFlowsApiTests(ApiTestFactory factory) : IClassFixture<ApiTestFactory>
{
    [Fact]
    public async Task Register_and_bootstrap_return_family_context()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var authResponse = await RegisterAsync(client);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResponse.AccessToken);

        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");

        Assert.NotNull(bootstrap);
        Assert.Equal("Test Family", bootstrap.FamilyName);
        Assert.Equal("UTC", bootstrap.Timezone);
        Assert.Single(bootstrap.Profiles);
        Assert.Equal("Admin", bootstrap.Membership.Role);
        Assert.Contains("@planner.test", bootstrap.Membership.Email);
    }

    [Fact]
    public async Task Dashboard_overview_reflects_created_profile_event_meal_and_shopping_item()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var authResponse = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResponse.AccessToken);

        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        var profileResponse = await client.PostAsJsonAsync("/api/v1/profiles", new CreateProfileRequest("Mia", "pink"));
        Assert.Equal(HttpStatusCode.Created, profileResponse.StatusCode);

        var profile = await profileResponse.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.NotNull(profile);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startAtUtc = new DateTimeOffset(today.ToDateTime(new TimeOnly(16, 0), DateTimeKind.Utc));
        var endAtUtc = startAtUtc.AddHours(1);

        var shoppingResponse = await client.PostAsJsonAsync(
            "/api/v1/shopping",
            new CreateShoppingItemRequest("Milk", "Dairy", profile.Id));
        Assert.Equal(HttpStatusCode.Created, shoppingResponse.StatusCode);

        var calendarResponse = await client.PostAsJsonAsync(
            "/api/v1/calendar",
            new CreateCalendarEventRequest("Soccer Practice", "Bring water", startAtUtc, endAtUtc, profile.Id));
        Assert.Equal(HttpStatusCode.Created, calendarResponse.StatusCode);

        var mealResponse = await client.PostAsJsonAsync(
            "/api/v1/meals",
            new CreateMealPlanRequest(today, "Lasagna", "Extra salad on the side", profile.Id));
        Assert.Equal(HttpStatusCode.Created, mealResponse.StatusCode);

        var dashboard = await client.GetFromJsonAsync<DashboardOverviewResponse>($"/api/v1/dashboard/overview?date={today:yyyy-MM-dd}");

        Assert.NotNull(dashboard);
        Assert.Equal(today, dashboard.Date);
        Assert.Contains(dashboard.TodayEvents, x => x.Title == "Soccer Practice");
        Assert.NotNull(dashboard.TonightMeal);
        Assert.Equal("Lasagna", dashboard.TonightMeal.Title);
        Assert.Equal(1, dashboard.Shopping.OpenItemsCount);
        Assert.Contains("Milk", dashboard.Shopping.PreviewLabels);

        var todaySummary = Assert.Single(dashboard.Week, x => x.Date == today);
        Assert.Equal(1, todaySummary.EventCount);
        Assert.True(todaySummary.HasMeal);
    }

    [Fact]
    public async Task Meal_request_assignment_and_acceptance_create_planned_meal()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var authResponse = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResponse.AccessToken);

        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        var mealDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        var createRequestResponse = await client.PostAsJsonAsync(
            "/api/v1/meals/requests",
            new CreateMealRequestRequest(bootstrap.Profiles[0].Id, mealDate, "Pizza", "Thin crust tonight"));
        Assert.Equal(HttpStatusCode.Created, createRequestResponse.StatusCode);

        var mealRequest = await createRequestResponse.Content.ReadFromJsonAsync<MealRequestResponse>();
        Assert.NotNull(mealRequest);

        var assignResponse = await client.PutAsJsonAsync(
            $"/api/v1/meals/requests/{mealRequest.Id}/assign",
            new AssignMealRequestRequest(bootstrap.Profiles[0].Id));
        Assert.Equal(HttpStatusCode.OK, assignResponse.StatusCode);

        var acceptResponse = await client.PostAsync($"/api/v1/meals/requests/{mealRequest.Id}/accept", content: null);
        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);

        var weekStart = GetWeekStart(mealDate);
        var mealsWeek = await client.GetFromJsonAsync<WeeklyMealsResponse>($"/api/v1/meals/week?start={weekStart:yyyy-MM-dd}");
        var openRequests = await client.GetFromJsonAsync<MealRequestResponse[]>($"/api/v1/meals/requests?start={weekStart:yyyy-MM-dd}");

        Assert.NotNull(mealsWeek);
        Assert.Contains(mealsWeek.Meals, x => x.MealDate == mealDate && x.Title == "Pizza");
        Assert.NotNull(openRequests);
        Assert.DoesNotContain(openRequests, x => x.Id == mealRequest.Id);
    }

    private static async Task<AuthResponse> RegisterAsync(HttpClient client)
    {
        var email = $"test-{Guid.NewGuid():N}@planner.test";

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            new RegisterRequest(
                email,
                "Planner123!",
                "Test Family",
                "Alex",
                "UTC",
                "green"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authResponse);
        Assert.False(string.IsNullOrWhiteSpace(authResponse.AccessToken));

        return authResponse;
    }

    private static DateOnly GetWeekStart(DateOnly date)
    {
        var diff = date.DayOfWeek == DayOfWeek.Sunday
            ? -6
            : DayOfWeek.Monday - date.DayOfWeek;

        return date.AddDays(diff);
    }
}
