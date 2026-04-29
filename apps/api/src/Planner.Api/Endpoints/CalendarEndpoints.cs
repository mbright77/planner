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

        var familyTimeZone = ResolveTimeZone(membership.Family.Timezone);
        var familyNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, familyTimeZone);
        var targetDate = start ?? DateOnly.FromDateTime(familyNow.DateTime);
        var weekStart = GetWeekStart(targetDate);
        var weekEnd = weekStart.AddDays(6);

        var weekStartLocal = weekStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        var weekEndExclusiveLocal = weekEnd.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);

        var weekStartUtc = TimeZoneInfo.ConvertTimeToUtc(weekStartLocal, familyTimeZone);
        var weekEndExclusiveUtc = TimeZoneInfo.ConvertTimeToUtc(weekEndExclusiveLocal, familyTimeZone);

        var weekStartUtcOffset = new DateTimeOffset(weekStartUtc, TimeSpan.Zero);
        var weekEndExclusiveUtcOffset = new DateTimeOffset(weekEndExclusiveUtc, TimeSpan.Zero);

        var familyEventsRaw = await dbContext.CalendarEvents
            .AsNoTracking()
            .Include(x => x.Series)
            .Where(x => x.FamilyId == membership.FamilyId)
            .ToListAsync(cancellationToken);

        var familyEvents = familyEventsRaw
            .Where(x => x.StartAtUtc >= weekStartUtcOffset && x.StartAtUtc < weekEndExclusiveUtcOffset)
            .OrderBy(x => x.StartAtUtc)
            .ToList();

        var events = familyEvents
            .Select(x =>
            {
                var localDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(x.StartAtUtc.UtcDateTime, familyTimeZone).Date);
                return new CalendarEventResponse(
                    x.Id,
                    x.Title,
                    x.Notes,
                    localDate,
                    x.StartAtUtc,
                    x.EndAtUtc,
                    x.AssignedProfileId,
                    x.SeriesId != null,
                    x.SeriesId != null ? x.Series!.RepeatUntil : null);
            })
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

        var familyTimeZone = ResolveTimeZone(membership.Family.Timezone);

        var validation = await ValidateAssignedProfileAsync(membership.FamilyId, request.AssignedProfileId, dbContext, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        var localStart = request.Date.ToDateTime(request.StartTime, DateTimeKind.Unspecified);
        var localEnd = request.Date.ToDateTime(request.EndTime, DateTimeKind.Unspecified);
        var startUtcDt = TimeZoneInfo.ConvertTimeToUtc(localStart, familyTimeZone);
        var endUtcDt = TimeZoneInfo.ConvertTimeToUtc(localEnd, familyTimeZone);
        var startAtUtc = new DateTimeOffset(startUtcDt, TimeSpan.Zero);
        var endAtUtc = new DateTimeOffset(endUtcDt, TimeSpan.Zero);

        if (endAtUtc <= startAtUtc)
        {
            return Results.BadRequest(new { message = "Event end time must be after the start time." });
        }

        var recurrenceValidation = ValidateWeeklyRecurrence(request.RepeatsWeekly, request.RepeatUntil, startAtUtc);
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
                StartsAtUtc = startAtUtc,
                EndsAtUtc = endAtUtc,
                RepeatUntil = request.RepeatUntil!.Value,
                MaterializedThrough = DateOnly.FromDateTime(startAtUtc.UtcDateTime),
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
            StartAtUtc = startAtUtc,
            EndAtUtc = endAtUtc,
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
                DateOnly.FromDateTime(startAtUtc.UtcDateTime).AddDays(7),
                cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var eventLocalDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(calendarEvent.StartAtUtc.UtcDateTime, familyTimeZone).Date);
        return Results.Created($"/api/v1/calendar/{calendarEvent.Id}", ToResponse(calendarEvent, series?.RepeatUntil, eventLocalDate));
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

        var familyTimeZone = ResolveTimeZone(membership.Family.Timezone);

        var validation = await ValidateAssignedProfileAsync(membership.FamilyId, request.AssignedProfileId, dbContext, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        var localStart = request.Date.ToDateTime(request.StartTime, DateTimeKind.Unspecified);
        var localEnd = request.Date.ToDateTime(request.EndTime, DateTimeKind.Unspecified);
        var startUtcDt = TimeZoneInfo.ConvertTimeToUtc(localStart, familyTimeZone);
        var endUtcDt = TimeZoneInfo.ConvertTimeToUtc(localEnd, familyTimeZone);
        var startAtUtc = new DateTimeOffset(startUtcDt, TimeSpan.Zero);
        var endAtUtc = new DateTimeOffset(endUtcDt, TimeSpan.Zero);

        if (endAtUtc <= startAtUtc)
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
            if (updatedRepeatUntil < DateOnly.FromDateTime(startAtUtc.UtcDateTime))
            {
                return Results.BadRequest(new { message = "Recurring events must end on or after the occurrence date." });
            }

            series.Title = request.Title.Trim();
            series.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
            series.StartsAtUtc = startAtUtc;
            series.EndsAtUtc = endAtUtc;
            series.AssignedProfileId = request.AssignedProfileId;
            series.RepeatUntil = updatedRepeatUntil;

            var occurrenceDate = DateOnly.FromDateTime(startAtUtc.UtcDateTime);
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
                StartAtUtc = startAtUtc,
                EndAtUtc = endAtUtc,
                CreatedAtUtc = calendarEvent.CreatedAtUtc,
                AssignedProfileId = request.AssignedProfileId,
                SeriesId = series.Id,
            };

            dbContext.CalendarEvents.Add(updatedOccurrence);
            series.MaterializedThrough = occurrenceDate;

            await materializer.MaterializeFutureOccurrencesAsync(dbContext, series, occurrenceDate.AddDays(7), cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            var updatedLocalDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(updatedOccurrence.StartAtUtc.UtcDateTime, familyTimeZone).Date);
            return Results.Ok(ToResponse(updatedOccurrence, series.RepeatUntil, updatedLocalDate));
        }

        calendarEvent.Title = request.Title.Trim();
        calendarEvent.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        calendarEvent.StartAtUtc = startAtUtc;
        calendarEvent.EndAtUtc = endAtUtc;
        calendarEvent.AssignedProfileId = request.AssignedProfileId;

        await dbContext.SaveChangesAsync(cancellationToken);

        var eventLocalDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(calendarEvent.StartAtUtc.UtcDateTime, familyTimeZone).Date);
        return Results.Ok(ToResponse(calendarEvent, calendarEvent.Series?.RepeatUntil, eventLocalDate));
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

    private static CalendarEventResponse ToResponse(CalendarEvent calendarEvent, DateOnly? repeatUntil, DateOnly eventDate)
    {
        return new CalendarEventResponse(
            calendarEvent.Id,
            calendarEvent.Title,
            calendarEvent.Notes,
            eventDate,
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
            .Include(x => x.Family)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
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

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }
}
