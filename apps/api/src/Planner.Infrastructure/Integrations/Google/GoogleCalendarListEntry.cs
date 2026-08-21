namespace Planner.Infrastructure.Integrations.Google;

public sealed record GoogleCalendarListEntry(
    string GoogleCalendarId,
    string Summary,
    string? Description,
    string? ColorHex,
    string? TimeZone,
    string AccessRole,
    bool IsPrimary);
