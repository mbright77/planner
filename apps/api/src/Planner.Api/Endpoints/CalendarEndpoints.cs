using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Calendar;
using Planner.Domain;
using Planner.Infrastructure;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class CalendarEndpoints
{
    public static IEndpointRouteBuilder MapCalendarEndpoints(this IEndpointRouteBuilder app)
    {
        var calendar = app.MapGroup("/api/v1/calendar")
            .RequireAuthorization();

        calendar.MapGet("/week", GetWeekAsync)
            .Produces<WeeklyCalendarResponse>(StatusCodes.Status200OK);
        calendar.MapPost(string.Empty, CreateEventAsync)
            .Produces<CalendarEventResponse>(StatusCodes.Status201Created);
        calendar.MapPut("/{eventId:guid}", UpdateEventAsync)
            .Produces<CalendarEventResponse>(StatusCodes.Status200OK);

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

        var familyEvents = await dbContext.CalendarEvents
            .AsNoTracking()
            .Include(x => x.Series)
            .Where(x => x.FamilyId == membership.FamilyId)
            .ToListAsync(cancellationToken);

        var events = familyEvents
            .Where(x => x.StartAtUtc >= startUtc && x.StartAtUtc < endUtc)
            .OrderBy(x => x.StartAtUtc)
            .Select(x => new CalendarEventResponse(
                x.Id,
                x.Title,
                x.Notes,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AssignedProfileId,
                x.SeriesId != null,
                x.SeriesId != null ? x.Series!.RepeatUntil : null))
            .ToList();

        return Results.Ok(new WeeklyCalendarResponse(weekStart, weekEnd, events));
    }

    private static async Task<IResult> CreateEventAsync(
        HttpContext httpContext,
        CreateCalendarEventRequest request,
        PlannerDbContext dbContext,
        ICalendarSeriesMaterializer materializer,
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

        var recurrenceValidation = ValidateWeeklyRecurrence(request.RepeatsWeekly, request.RepeatUntil, request.StartAtUtc);
        if (recurrenceValidation is not null)
        {
            return recurrenceValidation;
        }

        CalendarEventSeries? series = null;
        if (request.RepeatsWeekly)
        {
            series = new CalendarEventSeries
            {
                Id = Guid.NewGuid(),
                FamilyId = membership.FamilyId,
                Title = request.Title.Trim(),
                Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                StartsAtUtc = request.StartAtUtc,
                EndsAtUtc = request.EndAtUtc,
                RepeatUntil = request.RepeatUntil!.Value,
                MaterializedThrough = DateOnly.FromDateTime(request.StartAtUtc.UtcDateTime),
                CreatedAtUtc = DateTimeOffset.UtcNow,
                AssignedProfileId = request.AssignedProfileId,
            };

            dbContext.CalendarEventSeries.Add(series);
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
            SeriesId = series?.Id,
        };

        dbContext.CalendarEvents.Add(calendarEvent);

        if (series is not null)
        {
            await materializer.MaterializeFutureOccurrencesAsync(
                dbContext,
                series,
                DateOnly.FromDateTime(request.StartAtUtc.UtcDateTime).AddDays(7),
                cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/v1/calendar/{calendarEvent.Id}", ToResponse(calendarEvent, series?.RepeatUntil));
    }

    private static async Task<IResult> UpdateEventAsync(
        HttpContext httpContext,
        Guid eventId,
        UpdateCalendarEventRequest request,
        PlannerDbContext dbContext,
        ICalendarSeriesMaterializer materializer,
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
            .Include(x => x.Series)
            .FirstOrDefaultAsync(x => x.Id == eventId && x.FamilyId == membership.FamilyId, cancellationToken);

        if (calendarEvent is null)
        {
            return Results.NotFound();
        }

        if (calendarEvent.SeriesId is Guid seriesId && request.ApplyToSeries)
        {
            var series = calendarEvent.Series;
            if (series is null || series.Id != seriesId)
            {
                series = await dbContext.CalendarEventSeries
                    .FirstOrDefaultAsync(x => x.Id == seriesId && x.FamilyId == membership.FamilyId, cancellationToken);
            }

            if (series is null)
            {
                return Results.NotFound();
            }

            var updatedRepeatUntil = request.RepeatUntil ?? series.RepeatUntil;
            if (updatedRepeatUntil < DateOnly.FromDateTime(request.StartAtUtc.UtcDateTime))
            {
                return Results.BadRequest(new { message = "Recurring events must end on or after the occurrence date." });
            }

            series.Title = request.Title.Trim();
            series.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
            series.StartsAtUtc = request.StartAtUtc;
            series.EndsAtUtc = request.EndAtUtc;
            series.AssignedProfileId = request.AssignedProfileId;
            series.RepeatUntil = updatedRepeatUntil;

            var occurrenceDate = DateOnly.FromDateTime(request.StartAtUtc.UtcDateTime);
            var seriesOccurrences = await dbContext.CalendarEvents
                .Where(x => x.SeriesId == series.Id)
                .ToListAsync(cancellationToken);

            var futureOccurrences = seriesOccurrences
                .Where(x => x.StartAtUtc >= calendarEvent.StartAtUtc)
                .ToList();

            dbContext.CalendarEvents.RemoveRange(futureOccurrences);

            var updatedOccurrence = new CalendarEvent
            {
                Id = Guid.NewGuid(),
                FamilyId = membership.FamilyId,
                Title = series.Title,
                Notes = series.Notes,
                StartAtUtc = request.StartAtUtc,
                EndAtUtc = request.EndAtUtc,
                CreatedAtUtc = calendarEvent.CreatedAtUtc,
                AssignedProfileId = request.AssignedProfileId,
                SeriesId = series.Id,
            };

            dbContext.CalendarEvents.Add(updatedOccurrence);
            series.MaterializedThrough = occurrenceDate;

            await materializer.MaterializeFutureOccurrencesAsync(dbContext, series, occurrenceDate.AddDays(7), cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(ToResponse(updatedOccurrence, series.RepeatUntil));
        }

        calendarEvent.Title = request.Title.Trim();
        calendarEvent.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        calendarEvent.StartAtUtc = request.StartAtUtc;
        calendarEvent.EndAtUtc = request.EndAtUtc;
        calendarEvent.AssignedProfileId = request.AssignedProfileId;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToResponse(calendarEvent, calendarEvent.Series?.RepeatUntil));
    }

    private static IResult? ValidateWeeklyRecurrence(bool repeatsWeekly, DateOnly? repeatUntil, DateTimeOffset startAtUtc)
    {
        if (!repeatsWeekly)
        {
            return null;
        }

        if (!repeatUntil.HasValue)
        {
            return Results.BadRequest(new { message = "Repeat until is required for weekly recurring events." });
        }

        return repeatUntil.Value < DateOnly.FromDateTime(startAtUtc.UtcDateTime)
            ? Results.BadRequest(new { message = "Recurring events must end on or after the first occurrence." })
            : null;
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

    private static CalendarEventResponse ToResponse(CalendarEvent calendarEvent, DateOnly? repeatUntil)
    {
        return new CalendarEventResponse(
            calendarEvent.Id,
            calendarEvent.Title,
            calendarEvent.Notes,
            calendarEvent.StartAtUtc,
            calendarEvent.EndAtUtc,
            calendarEvent.AssignedProfileId,
            calendarEvent.SeriesId is not null,
            repeatUntil);
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
