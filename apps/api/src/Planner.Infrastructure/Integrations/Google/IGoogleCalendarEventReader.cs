using Planner.Domain;

namespace Planner.Infrastructure.Integrations.Google;

public interface IGoogleCalendarEventReader
{
    // Reads events from every *selected* subscription on the connection for the given UTC range,
    // fanning out per calendar and containing per-calendar failures in the result's status rather
    // than throwing. Callers own SaveChangesAsync for any connection mutation this causes (e.g.
    // NeedsReauth from a failed token refresh).
    Task<GoogleCalendarReadResult> ReadEventsAsync(
        GoogleCalendarConnection connection,
        DateTimeOffset rangeStartUtc,
        DateTimeOffset rangeEndUtc,
        TimeZoneInfo familyTimeZone,
        CancellationToken cancellationToken);
}
