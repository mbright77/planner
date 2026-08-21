using Planner.Infrastructure.Calendar;

namespace Planner.Infrastructure.Integrations.Google;

// FailedCalendarNames names every subscription whose ListEventsAsync call failed or timed out,
// so a Partial status can say which calendar to distrust rather than just "something failed".
public sealed record GoogleCalendarReadResult(
    IReadOnlyList<AggregatedEvent> Events,
    GoogleSourceStatus Status,
    IReadOnlyList<string> FailedCalendarNames);
