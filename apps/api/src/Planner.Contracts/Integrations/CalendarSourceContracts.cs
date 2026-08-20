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
