namespace Planner.Contracts.Calendar;

public sealed record CalendarEventResponse(
    Guid Id,
    string Title,
    string? Notes,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    Guid? AssignedProfileId);

public sealed record WeeklyCalendarResponse(
    DateOnly WeekStart,
    DateOnly WeekEnd,
    IReadOnlyList<CalendarEventResponse> Events);

public sealed record CreateCalendarEventRequest(
    string Title,
    string? Notes,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    Guid? AssignedProfileId);

public sealed record UpdateCalendarEventRequest(
    string Title,
    string? Notes,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    Guid? AssignedProfileId);
