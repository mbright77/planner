namespace Planner.Infrastructure.Integrations.Google;

public interface IGoogleCalendarClient
{
    Task<IReadOnlyList<GoogleCalendarListEntry>> ListCalendarsAsync(string accessToken, CancellationToken cancellationToken);
}
