namespace Planner.Infrastructure.Calendar;

// The shape both the local EF query and the Google event reader map into, so
// ICalendarAggregator (a later step) can union them without a source-specific branch.
public sealed record AggregatedEvent(
    string Id,
    string Title,
    string? Notes,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    Guid? AssignedProfileId,
    string Source,
    string? SourceLabel,
    string? SourceColorHex,
    bool IsAllDay,
    bool IsReadOnly);

public enum GoogleSourceStatus
{
    Ok = 1,
    Partial = 2,
    Error = 3,
    NeedsReauth = 4,
}
