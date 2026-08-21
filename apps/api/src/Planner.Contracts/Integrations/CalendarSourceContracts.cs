namespace Planner.Contracts.Integrations;

public sealed record CalendarSourceSettingsResponse(
    string Sources,
    bool IsGoogleConfigured,
    GoogleConnectionSummary? Connection);

public sealed record GoogleConnectionSummary(
    string GoogleAccountEmail,
    string Status,
    DateTimeOffset ConnectedAtUtc,
    DateTimeOffset? CalendarsSyncedAtUtc,
    int SelectedCalendarCount);

public sealed record UpdateCalendarSourcesRequest(string Sources);

public sealed record GoogleAuthorizationUrlResponse(string AuthorizationUrl);

public sealed record GoogleCalendarSummary(
    string GoogleCalendarId,
    string DisplayName,
    string? ColorHex,
    string AccessRole,
    bool IsPrimary,
    bool IsSelected);

public sealed record GoogleCalendarListResponse(
    IReadOnlyList<GoogleCalendarSummary> Calendars,
    DateTimeOffset? CalendarsSyncedAtUtc);

public sealed record UpdateGoogleCalendarSelectionRequest(IReadOnlyList<string> SelectedCalendarIds);
