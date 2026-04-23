using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Calendar;
using Planner.Domain;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class CalendarEndpoints
{
    public static IEndpointRouteBuilder MapCalendarEndpoints(this IEndpointRouteBuilder app)
    {
        var calendar = app.MapGroup("/api/v1/calendar")
            .RequireAuthorization();

        calendar.MapGet("/week", GetWeekAsync);
        calendar.MapPost(string.Empty, CreateEventAsync);
        calendar.MapPut("/{eventId:guid}", UpdateEventAsync);

        return app;
    }

    private static async Task<IResult> GetWeekAsync(
        HttpContext httpContext,
        DateOnly? start,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var weekStart = start ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var weekEnd = weekStart.AddDays(6);
        var startUtc = weekStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endUtc = weekEnd.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var events = await dbContext.CalendarEvents
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId)
            .Where(x => x.StartAtUtc >= startUtc && x.StartAtUtc < endUtc)
            .OrderBy(x => x.StartAtUtc)
            .Select(x => new CalendarEventResponse(
                x.Id,
                x.Title,
                x.Notes,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AssignedProfileId))
            .ToListAsync(cancellationToken);

        return Results.Ok(new WeeklyCalendarResponse(weekStart, weekEnd, events));
    }

    private static async Task<IResult> CreateEventAsync(
        HttpContext httpContext,
        CreateCalendarEventRequest request,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var validation = await ValidateAssignedProfileAsync(membership.FamilyId, request.AssignedProfileId, dbContext, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        if (request.EndAtUtc <= request.StartAtUtc)
        {
            return Results.BadRequest(new { message = "Event end time must be after the start time." });
        }

        var calendarEvent = new CalendarEvent
        {
            Id = Guid.NewGuid(),
            FamilyId = membership.FamilyId,
            Title = request.Title.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            StartAtUtc = request.StartAtUtc,
            EndAtUtc = request.EndAtUtc,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            AssignedProfileId = request.AssignedProfileId,
        };

        dbContext.CalendarEvents.Add(calendarEvent);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/v1/calendar/{calendarEvent.Id}", ToResponse(calendarEvent));
    }

    private static async Task<IResult> UpdateEventAsync(
        HttpContext httpContext,
        Guid eventId,
        UpdateCalendarEventRequest request,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var validation = await ValidateAssignedProfileAsync(membership.FamilyId, request.AssignedProfileId, dbContext, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        if (request.EndAtUtc <= request.StartAtUtc)
        {
            return Results.BadRequest(new { message = "Event end time must be after the start time." });
        }

        var calendarEvent = await dbContext.CalendarEvents
            .FirstOrDefaultAsync(x => x.Id == eventId && x.FamilyId == membership.FamilyId, cancellationToken);

        if (calendarEvent is null)
        {
            return Results.NotFound();
        }

        calendarEvent.Title = request.Title.Trim();
        calendarEvent.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        calendarEvent.StartAtUtc = request.StartAtUtc;
        calendarEvent.EndAtUtc = request.EndAtUtc;
        calendarEvent.AssignedProfileId = request.AssignedProfileId;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToResponse(calendarEvent));
    }

    private static async Task<IResult?> ValidateAssignedProfileAsync(
        Guid familyId,
        Guid? assignedProfileId,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!assignedProfileId.HasValue)
        {
            return null;
        }

        var profileExists = await dbContext.Profiles.AnyAsync(
            x => x.Id == assignedProfileId.Value && x.FamilyId == familyId,
            cancellationToken);

        return profileExists
            ? null
            : Results.BadRequest(new { message = "The selected profile does not belong to this family." });
    }

    private static CalendarEventResponse ToResponse(CalendarEvent calendarEvent)
    {
        return new CalendarEventResponse(
            calendarEvent.Id,
            calendarEvent.Title,
            calendarEvent.Notes,
            calendarEvent.StartAtUtc,
            calendarEvent.EndAtUtc,
            calendarEvent.AssignedProfileId);
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
