namespace Planner.Infrastructure.Integrations.Google;

public interface IGoogleCalendarClient
{
    Task<IReadOnlyList<GoogleCalendarListEntry>> ListCalendarsAsync(string accessToken, CancellationToken cancellationToken);

    // One calendar per call - fan-out across selected calendars is IGoogleCalendarEventReader's
    // job, not this client's. timeMin/timeMax are UTC instants; timeZoneId is sent so Google
    // resolves floating and all-day values against the family's zone.
    Task<IReadOnlyList<GoogleCalendarEventEntry>> ListEventsAsync(
        string accessToken,
        string calendarId,
        DateTimeOffset timeMinUtc,
        DateTimeOffset timeMaxUtc,
        string timeZoneId,
        CancellationToken cancellationToken);
}
