using Microsoft.EntityFrameworkCore;
using Planner.Domain;
using Planner.Infrastructure.Persistence;

namespace Planner.Infrastructure;

public interface ICalendarSeriesMaterializer
{
    Task MaterializeFutureOccurrencesAsync(
        PlannerDbContext dbContext,
        CalendarEventSeries series,
        DateOnly fromDate,
        CancellationToken cancellationToken);
}

public sealed class CalendarSeriesMaterializer : ICalendarSeriesMaterializer
{
    private const int MaterializationWindowDays = 56;

    public async Task MaterializeFutureOccurrencesAsync(
        PlannerDbContext dbContext,
        CalendarEventSeries series,
        DateOnly fromDate,
        CancellationToken cancellationToken)
    {
        var seriesStartDate = DateOnly.FromDateTime(series.StartsAtUtc.UtcDateTime);
        var firstOccurrenceDate = AlignToSeriesDate(seriesStartDate, fromDate);
        var materializationLimit = GetMaterializationLimit(DateOnly.FromDateTime(DateTime.UtcNow), series.RepeatUntil);

        if (materializationLimit < firstOccurrenceDate)
        {
            if (series.MaterializedThrough < materializationLimit)
            {
                series.MaterializedThrough = materializationLimit;
            }

            return;
        }

        var materializationStartUtc = ToStartOfDayUtc(firstOccurrenceDate);
        var materializationEndUtc = ToStartOfDayUtc(materializationLimit.AddDays(1));

        var existingStarts = await dbContext.CalendarEvents
            .Where(x => x.SeriesId == series.Id)
            .Select(x => x.StartAtUtc)
            .ToListAsync(cancellationToken);

        var existingStartsSet = existingStarts
            .Where(x => x >= materializationStartUtc && x < materializationEndUtc)
            .ToHashSet();
        var startTime = TimeOnly.FromDateTime(series.StartsAtUtc.UtcDateTime);
        var duration = series.EndsAtUtc - series.StartsAtUtc;

        for (var occurrenceDate = firstOccurrenceDate; occurrenceDate <= materializationLimit; occurrenceDate = occurrenceDate.AddDays(7))
        {
            var occurrenceStart = new DateTimeOffset(occurrenceDate.ToDateTime(startTime, DateTimeKind.Utc));
            if (existingStartsSet.Contains(occurrenceStart))
            {
                continue;
            }

            dbContext.CalendarEvents.Add(new CalendarEvent
            {
                Id = Guid.NewGuid(),
                FamilyId = series.FamilyId,
                Title = series.Title,
                Notes = series.Notes,
                StartAtUtc = occurrenceStart,
                EndAtUtc = occurrenceStart + duration,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                AssignedProfileId = series.AssignedProfileId,
                SeriesId = series.Id,
            });
        }

        if (series.MaterializedThrough < materializationLimit)
        {
            series.MaterializedThrough = materializationLimit;
        }
    }

    private static DateOnly GetMaterializationLimit(DateOnly currentDate, DateOnly repeatUntil)
    {
        var horizon = currentDate.AddDays(MaterializationWindowDays);
        return horizon < repeatUntil ? horizon : repeatUntil;
    }

    private static DateOnly AlignToSeriesDate(DateOnly seriesStartDate, DateOnly fromDate)
    {
        if (fromDate <= seriesStartDate)
        {
            return seriesStartDate;
        }

        var daysDifference = fromDate.DayNumber - seriesStartDate.DayNumber;
        var remainder = daysDifference % 7;

        return remainder == 0
            ? fromDate
            : fromDate.AddDays(7 - remainder);
    }

    private static DateTimeOffset ToStartOfDayUtc(DateOnly date)
    {
        return new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
    }
}
