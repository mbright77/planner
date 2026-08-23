using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Planner.Api.Extensions;
using Planner.Contracts.Dashboard;
using Planner.Domain;
using Planner.Infrastructure.Calendar;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class DashboardEndpoints
{
    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        var dashboard = app.MapGroup("/api/v1/dashboard")
            .RequireAuthorization();

        dashboard.MapGet("/overview", GetOverviewAsync)
            .Produces<DashboardOverviewResponse>(StatusCodes.Status200OK);

        return app;
    }

    private static async Task<IResult> GetOverviewAsync(
        HttpContext httpContext,
        DateOnly? date,
        PlannerDbContext dbContext,
        IOptions<GoogleOptions> googleOptions,
        ICalendarAggregator calendarAggregator,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var familyTimeZone = FamilyScheduleHelpers.ResolveTimeZone(membership.Family.Timezone);
        var familyNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, familyTimeZone);
        var targetDate = date ?? DateOnly.FromDateTime(familyNow.DateTime);
        var weekStart = FamilyScheduleHelpers.GetWeekStart(targetDate);
        var weekEnd = weekStart.AddDays(6);

        var weekStartUtc = new DateTimeOffset(
            TimeZoneInfo.ConvertTimeToUtc(weekStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), familyTimeZone),
            TimeSpan.Zero);
        var weekEndExclusiveUtc = new DateTimeOffset(
            TimeZoneInfo.ConvertTimeToUtc(weekEnd.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), familyTimeZone),
            TimeSpan.Zero);
        var dayStartUtc = new DateTimeOffset(
            TimeZoneInfo.ConvertTimeToUtc(targetDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), familyTimeZone),
            TimeSpan.Zero);
        var dayEndExclusiveUtc = new DateTimeOffset(
            TimeZoneInfo.ConvertTimeToUtc(targetDate.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), familyTimeZone),
            TimeSpan.Zero);

        var preference = await dbContext.UserCalendarPreferences
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == membership.UserId, cancellationToken);

        var googleConnection = await dbContext.GoogleCalendarConnections
            .AsNoTracking()
            .Include(x => x.Subscriptions)
            .FirstOrDefaultAsync(x => x.UserId == membership.UserId, cancellationToken);

        var effectiveSources = preference?.Sources ?? CalendarSourceSelection.Local;

        // Use the aggregator to get merged events
        var aggregationResult = await calendarAggregator.AggregateAsync(
            membership.FamilyId,
            weekStartUtc,
            weekEndExclusiveUtc,
            dayStartUtc,
            dayEndExclusiveUtc,
            familyTimeZone,
            googleConnection,
            effectiveSources,
            cancellationToken);

        // Fetch meals
        var weekMeals = await dbContext.MealPlans
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId)
            .Where(x => x.MealDate >= weekStart && x.MealDate <= weekEnd)
            .OrderBy(x => x.MealDate)
            .Select(x => new
            {
                x.Id,
                x.MealDate,
                x.Title,
                x.Notes,
                x.RecipeUrl,
                x.OwnerProfileId,
            })
            .ToListAsync(cancellationToken);

        var shoppingPreview = await dbContext.ShoppingItems
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId && !x.IsCompleted)
            .Select(x => new
            {
                x.Label,
                x.CreatedAtUtc,
            })
            .ToListAsync(cancellationToken);

        var shoppingPreviewLabels = shoppingPreview
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => x.Label)
            .ToArray();

        var shoppingCount = await dbContext.ShoppingItems
            .AsNoTracking()
            .CountAsync(x => x.FamilyId == membership.FamilyId && !x.IsCompleted, cancellationToken);

        var tonightMealData = weekMeals.FirstOrDefault(x => x.MealDate == targetDate);
        var tonightMeal = tonightMealData is null
            ? null
            : new DashboardMealSummary(
                tonightMealData.Id,
                tonightMealData.Title,
                tonightMealData.Notes,
                tonightMealData.RecipeUrl,
                tonightMealData.OwnerProfileId);

        // Map next upcoming event to summary
        var upcomingEvent = aggregationResult.NextUpcomingEvent is null
            ? null
            : new DashboardUpcomingEventSummary(
                aggregationResult.NextUpcomingEvent.Id,
                aggregationResult.NextUpcomingEvent.Title,
                aggregationResult.NextUpcomingEvent.StartAtUtc,
                aggregationResult.NextUpcomingEvent.EndAtUtc,
                aggregationResult.NextUpcomingEvent.AssignedProfileId);

        var mealsByDate = weekMeals.ToDictionary(x => x.MealDate, x => x.Id);
        
        // Count events by date from merged week events
        var eventCountsByDate = aggregationResult.WeekEvents
            .GroupBy(x => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(x.StartAtUtc.UtcDateTime, familyTimeZone).Date))
            .ToDictionary(x => x.Key, x => x.Count());

        var week = Enumerable.Range(0, 7)
            .Select(offset =>
            {
                var currentDate = weekStart.AddDays(offset);

                return new DashboardDaySummary(
                    currentDate,
                    eventCountsByDate.GetValueOrDefault(currentDate, 0),
                    mealsByDate.ContainsKey(currentDate));
            })
            .ToArray();

        // Map Google status to string
        var googleStatusString = MapGoogleStatus(googleOptions.Value, googleConnection, aggregationResult.GoogleStatus, aggregationResult.FailedCalendarNames);

        var sources = new DashboardSourcesSummary(
            effectiveSources.ToString(),
            new DashboardGoogleSourceStatus(googleStatusString, aggregationResult.FailedCalendarNames));

        var response = new DashboardOverviewResponse(
            targetDate,
            weekStart,
            weekEnd,
            week,
            aggregationResult.TodayEvents,
            tonightMeal,
            new DashboardShoppingSummary(shoppingCount, shoppingPreviewLabels),
            upcomingEvent,
            sources);

        return Results.Ok(response);
    }

    private static string MapGoogleStatus(
        GoogleOptions googleOptions,
        GoogleCalendarConnection? connection,
        GoogleSourceStatus aggregationStatus,
        IReadOnlyList<string> failedCalendarNames)
    {
        // If there's a connection, use its status or the aggregation status
        if (connection is not null)
        {
            // If aggregation detected a problem, use that
            if (aggregationStatus != GoogleSourceStatus.Ok)
            {
                return aggregationStatus switch
                {
                    GoogleSourceStatus.NeedsReauth => "NeedsReauth",
                    GoogleSourceStatus.Error => "Error",
                    GoogleSourceStatus.Partial => "Partial",
                    _ => "Connected"
                };
            }
            
            // Otherwise use the connection's stored status
            return connection.Status == GoogleConnectionStatus.NeedsReauth ? "NeedsReauth" : "Connected";
        }

        // No connection - check if Google is configured
        return googleOptions.IsConfigured ? "NotConnected" : "NotConfigured";
    }



    private static Task<FamilyMembership?> GetMembershipAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.GetRequiredUserId();

        return dbContext.FamilyMemberships
            .AsNoTracking()
            .Include(x => x.Family)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
    }
}
