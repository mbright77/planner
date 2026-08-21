using Planner.Infrastructure.Integrations.Google;

namespace Planner.ApiTests.Fakes;

public sealed class FakeGoogleCalendarClient : IGoogleCalendarClient
{
    public List<GoogleCalendarListEntry> CalendarsToReturn { get; set; } = [];

    public Exception? NextListException { get; set; }

    public List<string> AccessTokensUsed { get; } = [];

    public Task<IReadOnlyList<GoogleCalendarListEntry>> ListCalendarsAsync(string accessToken, CancellationToken cancellationToken)
    {
        AccessTokensUsed.Add(accessToken);

        if (NextListException is not null)
        {
            throw NextListException;
        }

        return Task.FromResult<IReadOnlyList<GoogleCalendarListEntry>>(CalendarsToReturn);
    }

    public void Reset()
    {
        CalendarsToReturn = [];
        NextListException = null;
        AccessTokensUsed.Clear();
    }
}
