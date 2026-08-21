using Planner.Infrastructure.Integrations.Google;

namespace Planner.ApiTests.Fakes;

public sealed class FakeGoogleCalendarClient : IGoogleCalendarClient
{
    public List<GoogleCalendarListEntry> CalendarsToReturn { get; set; } = [];

    public Exception? NextListException { get; set; }

    public Dictionary<string, List<GoogleCalendarEventEntry>> EventsByCalendarId { get; } = [];

    public Exception? NextListEventsException { get; set; }

    public List<string> AccessTokensUsed { get; } = [];

    public List<string> ListEventsCalendarIds { get; } = [];

    public Task<IReadOnlyList<GoogleCalendarListEntry>> ListCalendarsAsync(string accessToken, CancellationToken cancellationToken)
    {
        AccessTokensUsed.Add(accessToken);

        if (NextListException is not null)
        {
            throw NextListException;
        }

        return Task.FromResult<IReadOnlyList<GoogleCalendarListEntry>>(CalendarsToReturn);
    }

    public Task<IReadOnlyList<GoogleCalendarEventEntry>> ListEventsAsync(
        string accessToken,
        string calendarId,
        DateTimeOffset timeMinUtc,
        DateTimeOffset timeMaxUtc,
        string timeZoneId,
        CancellationToken cancellationToken)
    {
        AccessTokensUsed.Add(accessToken);
        ListEventsCalendarIds.Add(calendarId);

        if (NextListEventsException is not null)
        {
            throw NextListEventsException;
        }

        var events = EventsByCalendarId.TryGetValue(calendarId, out var found) ? found : [];
        return Task.FromResult<IReadOnlyList<GoogleCalendarEventEntry>>(events);
    }

    public void Reset()
    {
        CalendarsToReturn = [];
        NextListException = null;
        EventsByCalendarId.Clear();
        NextListEventsException = null;
        AccessTokensUsed.Clear();
        ListEventsCalendarIds.Clear();
    }
}
