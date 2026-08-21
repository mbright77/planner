namespace Planner.Infrastructure.Integrations.Google;

// The parsed-but-unfiltered shape of one Google events.list item. Cancelled/declined filtering
// and the family-timezone all-day conversion are deliberately not done here - see
// GoogleCalendarEventMapper - so this stays a thin transport-level parse, matching
// GoogleCalendarListEntry.
public sealed record GoogleCalendarEventEntry(
    string GoogleEventId,
    string Status,
    string Title,
    string? Description,
    bool IsAllDay,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTimeOffset? StartAtUtc,
    DateTimeOffset? EndAtUtc,
    bool IsDeclinedBySelf);
