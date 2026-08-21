using Planner.Contracts.Dashboard;
using Planner.Domain;

namespace Planner.Infrastructure.Calendar;

public interface ICalendarAggregator
{
    // Aggregates local calendar events with Google calendar events for the given week range.
    // Returns merged events sorted by StartAtUtc, then by title for stable ordering.
    // Google failures never throw - they are surfaced in the returned status.
    Task<AggregationResult> AggregateAsync(
        Guid familyId,
        DateTimeOffset weekStartUtc,
        DateTimeOffset weekEndExclusiveUtc,
        DateTimeOffset dayStartUtc,
        DateTimeOffset dayEndExclusiveUtc,
        TimeZoneInfo familyTimeZone,
        GoogleCalendarConnection? googleConnection,
        CalendarSourceSelection effectiveSources,
        CancellationToken cancellationToken);
}

public sealed record AggregationResult(
    IReadOnlyList<DashboardEventSummary> TodayEvents,
    IReadOnlyList<AggregatedEvent> WeekEvents,
    AggregatedEvent? NextUpcomingEvent,
    GoogleSourceStatus GoogleStatus,
    IReadOnlyList<string> FailedCalendarNames);
