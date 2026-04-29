using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Planner.Contracts.Auth;
using Planner.Contracts.Bootstrap;
using Planner.Contracts.Calendar;
using Planner.Contracts.Dashboard;
using Planner.Contracts.Meals;
using Planner.Contracts.Privacy;
using Planner.Contracts.Profiles;
using Planner.Contracts.Invites;
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
        Assert.False(profile.HasLogin);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startAtUtc = new DateTimeOffset(today.ToDateTime(new TimeOnly(16, 0), DateTimeKind.Utc));
        var endAtUtc = startAtUtc.AddHours(1);

        var shoppingResponse = await client.PostAsJsonAsync(
            "/api/v1/shopping",
            new CreateShoppingItemRequest("Milk", "Dairy", profile.Id));
        Assert.Equal(HttpStatusCode.Created, shoppingResponse.StatusCode);

        var calendarResponse = await client.PostAsJsonAsync(
            "/api/v1/calendar",
            new CreateCalendarEventRequest("Soccer Practice", "Bring water", today, new TimeOnly(16, 0), new TimeOnly(17, 0), profile.Id, false, null));
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
            new CreateMealRequestRequest(mealDate, "Pizza", "Thin crust tonight"));
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

    [Fact]
    public async Task Recurring_calendar_event_materializes_future_occurrences_and_updates_series()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var authResponse = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResponse.AccessToken);

        var bootstrap = await client.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(bootstrap);

        var weekStart = GetWeekStart(DateOnly.FromDateTime(DateTime.UtcNow).AddDays(7));
        var firstStart = new DateTimeOffset(weekStart.ToDateTime(new TimeOnly(15, 0), DateTimeKind.Utc));
        var firstEnd = firstStart.AddHours(1);
        var repeatUntil = weekStart.AddDays(14);

        var createResponse = await client.PostAsJsonAsync(
            "/api/v1/calendar",
            new CreateCalendarEventRequest("Swim Lessons", "Bring goggles", weekStart, new TimeOnly(15, 0), new TimeOnly(16, 0), bootstrap.Profiles[0].Id, true, repeatUntil));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var createdEvent = await createResponse.Content.ReadFromJsonAsync<CalendarEventResponse>();
        Assert.NotNull(createdEvent);
        Assert.True(createdEvent.IsRecurring);
        Assert.Equal(repeatUntil, createdEvent.RepeatUntil);

        var currentWeek = await client.GetFromJsonAsync<WeeklyCalendarResponse>($"/api/v1/calendar/week?start={weekStart:yyyy-MM-dd}");
        var nextWeek = await client.GetFromJsonAsync<WeeklyCalendarResponse>($"/api/v1/calendar/week?start={weekStart.AddDays(7):yyyy-MM-dd}");
        var finalWeek = await client.GetFromJsonAsync<WeeklyCalendarResponse>($"/api/v1/calendar/week?start={weekStart.AddDays(14):yyyy-MM-dd}");

        Assert.NotNull(currentWeek);
        Assert.NotNull(nextWeek);
        Assert.NotNull(finalWeek);
        Assert.Contains(currentWeek.Events, x => x.Title == "Swim Lessons" && x.IsRecurring);
        Assert.Contains(nextWeek.Events, x => x.Title == "Swim Lessons" && x.IsRecurring);
        Assert.Contains(finalWeek.Events, x => x.Title == "Swim Lessons" && x.IsRecurring);

        var secondOccurrence = Assert.Single(nextWeek.Events, x => x.Title == "Swim Lessons");
        var updatedStart = new DateTimeOffset(weekStart.AddDays(7).ToDateTime(new TimeOnly(16, 0), DateTimeKind.Utc));
        var updatedEnd = updatedStart.AddHours(1);

        var updateResponse = await client.PutAsJsonAsync(
            $"/api/v1/calendar/{secondOccurrence.Id}",
            new UpdateCalendarEventRequest("Swim Lessons", "Coach moved the slot", weekStart.AddDays(7), new TimeOnly(16, 0), new TimeOnly(17, 0), bootstrap.Profiles[0].Id, true, repeatUntil));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updatedNextWeek = await client.GetFromJsonAsync<WeeklyCalendarResponse>($"/api/v1/calendar/week?start={weekStart.AddDays(7):yyyy-MM-dd}");
        var updatedFinalWeek = await client.GetFromJsonAsync<WeeklyCalendarResponse>($"/api/v1/calendar/week?start={weekStart.AddDays(14):yyyy-MM-dd}");

        Assert.NotNull(updatedNextWeek);
        Assert.NotNull(updatedFinalWeek);
        Assert.Contains(updatedNextWeek.Events, x => x.StartAtUtc == updatedStart && x.Notes == "Coach moved the slot");
        Assert.Contains(updatedFinalWeek.Events, x => x.StartAtUtc == updatedStart.AddDays(7) && x.Notes == "Coach moved the slot");
    }

    [Fact]
    public async Task Family_admin_can_create_and_accept_invite()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var authResponse = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResponse.AccessToken);

        var createInviteResponse = await client.PostAsJsonAsync(
            "/api/v1/family-invites",
            new CreateFamilyInviteRequest("adult@example.com", null));
        Assert.Equal(HttpStatusCode.Created, createInviteResponse.StatusCode);

        var invite = await createInviteResponse.Content.ReadFromJsonAsync<FamilyInviteResponse>();
        Assert.NotNull(invite);
        Assert.Equal("adult@example.com", invite.Email);
        Assert.Null(invite.ProfileId);

        var inviteDetails = await client.GetFromJsonAsync<FamilyInviteDetailsResponse>($"/api/v1/invites/{invite.Token}");
        Assert.NotNull(inviteDetails);
        Assert.Equal("adult@example.com", inviteDetails.Email);
        Assert.False(inviteDetails.IsExpired);
        Assert.False(inviteDetails.IsAccepted);
        Assert.Null(inviteDetails.ProfileId);

        var acceptResponse = await client.PostAsJsonAsync(
            $"/api/v1/invites/{invite.Token}/accept",
            new AcceptFamilyInviteRequest("adult@example.com", "Planner123!", "Taylor", "blue"));
        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);

        var acceptedInvite = await client.GetFromJsonAsync<FamilyInviteDetailsResponse>($"/api/v1/invites/{invite.Token}");
        Assert.NotNull(acceptedInvite);
        Assert.True(acceptedInvite.IsAccepted);

        var profiles = await client.GetFromJsonAsync<IReadOnlyList<ProfileResponse>>("/api/v1/profiles");
        Assert.NotNull(profiles);
        Assert.Contains(profiles, x => x.DisplayName == "Taylor" && x.HasLogin);
    }

    [Fact]
    public async Task Family_admin_can_invite_existing_profile_without_creating_duplicate_profile()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var authResponse = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResponse.AccessToken);

        var createProfileResponse = await client.PostAsJsonAsync(
            "/api/v1/profiles",
            new CreateProfileRequest("Emma", "pink"));
        Assert.Equal(HttpStatusCode.Created, createProfileResponse.StatusCode);

        var existingProfile = await createProfileResponse.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.NotNull(existingProfile);
        Assert.False(existingProfile.HasLogin);

        var createInviteResponse = await client.PostAsJsonAsync(
            "/api/v1/family-invites",
            new CreateFamilyInviteRequest("emma@example.com", existingProfile.Id));
        Assert.Equal(HttpStatusCode.Created, createInviteResponse.StatusCode);

        var invite = await createInviteResponse.Content.ReadFromJsonAsync<FamilyInviteResponse>();
        Assert.NotNull(invite);
        Assert.Equal(existingProfile.Id, invite.ProfileId);
        Assert.Equal("Emma", invite.ProfileDisplayName);

        var inviteDetails = await client.GetFromJsonAsync<FamilyInviteDetailsResponse>($"/api/v1/invites/{invite.Token}");
        Assert.NotNull(inviteDetails);
        Assert.Equal(existingProfile.Id, inviteDetails.ProfileId);
        Assert.Equal("Emma", inviteDetails.ProfileDisplayName);
        Assert.Equal("pink", inviteDetails.ProfileColorKey);

        var acceptResponse = await client.PostAsJsonAsync(
            $"/api/v1/invites/{invite.Token}/accept",
            new AcceptFamilyInviteRequest("emma@example.com", "Planner123!", null, null));
        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);

        var profiles = await client.GetFromJsonAsync<IReadOnlyList<ProfileResponse>>("/api/v1/profiles");
        Assert.NotNull(profiles);
        Assert.Equal(2, profiles.Count);

        var linkedProfile = Assert.Single(profiles, x => x.Id == existingProfile.Id);
        Assert.Equal("Emma", linkedProfile.DisplayName);
        Assert.True(linkedProfile.HasLogin);
    }

    [Fact]
    public async Task Inactive_linked_member_can_request_meals_but_cannot_plan_or_accept_them()
    {
        await factory.ResetDatabaseAsync();
        using var adminClient = factory.CreateClient();

        var adminAuth = await RegisterAsync(adminClient);
        adminClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminAuth.AccessToken);

        var createProfileResponse = await adminClient.PostAsJsonAsync(
            "/api/v1/profiles",
            new CreateProfileRequest("Sam", "blue"));
        Assert.Equal(HttpStatusCode.Created, createProfileResponse.StatusCode);

        var profile = await createProfileResponse.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.NotNull(profile);

        var createInviteResponse = await adminClient.PostAsJsonAsync(
            "/api/v1/family-invites",
            new CreateFamilyInviteRequest("sam@example.com", profile.Id));
        Assert.Equal(HttpStatusCode.Created, createInviteResponse.StatusCode);

        var invite = await createInviteResponse.Content.ReadFromJsonAsync<FamilyInviteResponse>();
        Assert.NotNull(invite);

        var acceptResponse = await adminClient.PostAsJsonAsync(
            $"/api/v1/invites/{invite.Token}/accept",
            new AcceptFamilyInviteRequest("sam@example.com", "Planner123!", null, null));
        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);

        var memberLoginResponse = await adminClient.PostAsJsonAsync(
            "/api/v1/auth/login",
            new LoginRequest("sam@example.com", "Planner123!"));
        Assert.Equal(HttpStatusCode.OK, memberLoginResponse.StatusCode);

        var memberAuth = await memberLoginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(memberAuth);

        var deactivateResponse = await adminClient.PutAsJsonAsync(
            $"/api/v1/profiles/{profile.Id}",
            new UpdateProfileRequest("Sam", "blue", false));
        Assert.Equal(HttpStatusCode.OK, deactivateResponse.StatusCode);

        using var memberClient = factory.CreateClient();
        memberClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberAuth.AccessToken);

        var memberBootstrap = await memberClient.GetFromJsonAsync<BootstrapResponse>("/api/v1/me/bootstrap");
        Assert.NotNull(memberBootstrap);
        Assert.False(memberBootstrap.Membership.CanPlanMeals);

        var requestResponse = await memberClient.PostAsJsonAsync(
            "/api/v1/meals/requests",
            new CreateMealRequestRequest(DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1), "Tacos", null));
        Assert.Equal(HttpStatusCode.Created, requestResponse.StatusCode);

        var createdRequest = await requestResponse.Content.ReadFromJsonAsync<MealRequestResponse>();
        Assert.NotNull(createdRequest);
        Assert.Equal(profile.Id, createdRequest.RequesterProfileId);

        var planResponse = await memberClient.PostAsJsonAsync(
            "/api/v1/meals",
            new CreateMealPlanRequest(DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1), "Pasta", null, profile.Id));
        Assert.Equal(HttpStatusCode.Forbidden, planResponse.StatusCode);

        var acceptRequestResponse = await memberClient.PostAsync($"/api/v1/meals/requests/{createdRequest.Id}/accept", null);
        Assert.Equal(HttpStatusCode.Forbidden, acceptRequestResponse.StatusCode);
    }

    [Fact]
    public async Task User_can_delete_account_when_family_still_has_another_member()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var authResponse = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResponse.AccessToken);

        var createInviteResponse = await client.PostAsJsonAsync(
            "/api/v1/family-invites",
            new CreateFamilyInviteRequest("adult@example.com", null));
        Assert.Equal(HttpStatusCode.Created, createInviteResponse.StatusCode);

        var invite = await createInviteResponse.Content.ReadFromJsonAsync<FamilyInviteResponse>();
        Assert.NotNull(invite);

        var acceptResponse = await client.PostAsJsonAsync(
            $"/api/v1/invites/{invite.Token}/accept",
            new AcceptFamilyInviteRequest("adult@example.com", "Planner123!", "Taylor", "blue"));
        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);

        var deleteResponse = await client.PostAsJsonAsync(
            "/api/v1/privacy/account/delete",
            new DeleteAccountRequest("Planner123!"));
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

        var bootstrapResponse = await client.GetAsync("/api/v1/me/bootstrap");
        Assert.Equal(HttpStatusCode.NotFound, bootstrapResponse.StatusCode);
    }

    [Fact]
    public async Task Admin_can_delete_family_after_password_confirmation()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var authResponse = await RegisterAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResponse.AccessToken);

        var deleteResponse = await client.PostAsJsonAsync(
            "/api/v1/privacy/family/delete",
            new DeleteFamilyRequest("Planner123!"));
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

        var bootstrapResponse = await client.GetAsync("/api/v1/me/bootstrap");
        Assert.Equal(HttpStatusCode.NotFound, bootstrapResponse.StatusCode);
    }

    [Fact]
    public async Task Login_endpoint_returns_security_headers()
    {
        await factory.ResetDatabaseAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new LoginRequest("missing@planner.test", "wrong-password"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(response.Headers.Contains("X-Content-Type-Options"));
        Assert.True(response.Headers.Contains("X-Frame-Options"));
        Assert.True(response.Headers.Contains("Referrer-Policy"));
        Assert.True(response.Headers.Contains("Permissions-Policy"));
        Assert.True(response.Headers.Contains("Content-Security-Policy"));
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
