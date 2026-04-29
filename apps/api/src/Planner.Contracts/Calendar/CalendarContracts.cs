namespace Planner.Contracts.Calendar;

public sealed record CalendarEventResponse(
    Guid Id,
    string Title,
    string? Notes,
    DateOnly Date,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    Guid? AssignedProfileId,
    bool IsRecurring,
    DateOnly? RepeatUntil);

public sealed record WeeklyCalendarResponse(
    DateOnly WeekStart,
    DateOnly WeekEnd,
    IReadOnlyList<CalendarEventResponse> Events);

public sealed record CreateCalendarEventRequest(
    string Title,
    string? Notes,
    DateOnly Date,
    TimeOnly StartTime,
    TimeOnly EndTime,
    Guid? AssignedProfileId,
    bool RepeatsWeekly,
    DateOnly? RepeatUntil);

public sealed record UpdateCalendarEventRequest(
    string Title,
    string? Notes,
    DateOnly Date,
    TimeOnly StartTime,
    TimeOnly EndTime,
    Guid? AssignedProfileId,
    bool ApplyToSeries,
    DateOnly? RepeatUntil);
