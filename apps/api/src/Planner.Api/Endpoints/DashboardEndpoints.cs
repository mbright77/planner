using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Dashboard;
using Planner.Domain;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class DashboardEndpoints
{
    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        var dashboard = app.MapGroup("/api/v1/dashboard")
            .RequireAuthorization();

        dashboard.MapGet("/overview", GetOverviewAsync);

        return app;
    }

    private static async Task<IResult> GetOverviewAsync(
        HttpContext httpContext,
        DateOnly? date,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var weekStart = GetWeekStart(targetDate);
        var weekEnd = weekStart.AddDays(6);
        var weekStartUtc = new DateTimeOffset(weekStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        var weekEndExclusiveUtc = new DateTimeOffset(weekEnd.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        var dayStartUtc = new DateTimeOffset(targetDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        var dayEndExclusiveUtc = new DateTimeOffset(targetDate.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        var now = DateTimeOffset.UtcNow;

        var weekEvents = await dbContext.CalendarEvents
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId)
            .Where(x => x.StartAtUtc >= weekStartUtc && x.StartAtUtc < weekEndExclusiveUtc)
            .OrderBy(x => x.StartAtUtc)
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.Notes,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AssignedProfileId,
            })
            .ToListAsync(cancellationToken);

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
                x.OwnerProfileId,
            })
            .ToListAsync(cancellationToken);

        var shoppingPreview = await dbContext.ShoppingItems
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId && !x.IsCompleted)
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => x.Label)
            .Take(3)
            .ToListAsync(cancellationToken);

        var shoppingCount = await dbContext.ShoppingItems
            .AsNoTracking()
            .CountAsync(x => x.FamilyId == membership.FamilyId && !x.IsCompleted, cancellationToken);

        var todayEvents = weekEvents
            .Where(x => x.StartAtUtc >= dayStartUtc && x.StartAtUtc < dayEndExclusiveUtc)
            .Select(x => new DashboardEventSummary(
                x.Id,
                x.Title,
                x.Notes,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AssignedProfileId,
                x.EndAtUtc < now))
            .ToArray();

        var tonightMealData = weekMeals.FirstOrDefault(x => x.MealDate == targetDate);
        var tonightMeal = tonightMealData is null
            ? null
            : new DashboardMealSummary(
                tonightMealData.Id,
                tonightMealData.Title,
                tonightMealData.Notes,
                tonightMealData.OwnerProfileId);

        var upcomingEventData = await dbContext.CalendarEvents
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId)
            .Where(x => x.StartAtUtc >= now)
            .OrderBy(x => x.StartAtUtc)
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AssignedProfileId,
            })
            .FirstOrDefaultAsync(cancellationToken);

        var upcomingEvent = upcomingEventData is null
            ? null
            : new DashboardUpcomingEventSummary(
                upcomingEventData.Id,
                upcomingEventData.Title,
                upcomingEventData.StartAtUtc,
                upcomingEventData.EndAtUtc,
                upcomingEventData.AssignedProfileId);

        var mealsByDate = weekMeals.ToDictionary(x => x.MealDate, x => x.Id);
        var eventCountsByDate = weekEvents
            .GroupBy(x => DateOnly.FromDateTime(x.StartAtUtc.UtcDateTime))
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

        var response = new DashboardOverviewResponse(
            targetDate,
            weekStart,
            weekEnd,
            week,
            todayEvents,
            tonightMeal,
            new DashboardShoppingSummary(shoppingCount, shoppingPreview),
            upcomingEvent);

        return Results.Ok(response);
    }

    private static DateOnly GetWeekStart(DateOnly date)
    {
        var diff = date.DayOfWeek switch
        {
            DayOfWeek.Sunday => -6,
            _ => DayOfWeek.Monday - date.DayOfWeek,
        };

        return date.AddDays(diff);
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
