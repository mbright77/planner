using Planner.Domain;
using Planner.Infrastructure.Calendar;

namespace Planner.Infrastructure.Integrations.Google;

public static class GoogleCalendarEventMapper
{
    // Returns null when the event should not be surfaced at all (cancelled, or declined by the
    // connected user) rather than mapping it and relying on a caller to filter it back out.
    public static AggregatedEvent? Map(GoogleCalendarEventEntry entry, GoogleCalendarSubscription subscription, TimeZoneInfo familyTimeZone)
    {
        if (string.Equals(entry.Status, "cancelled", StringComparison.OrdinalIgnoreCase) || entry.IsDeclinedBySelf)
        {
            return null;
        }

        DateTimeOffset startAtUtc;
        DateTimeOffset endAtUtc;

        if (entry.IsAllDay)
        {
            if (entry.StartDate is null)
            {
                return null;
            }

            // For all-day events, end.date is exclusive and optional in Google's API.
            // If not provided, default to start date + 1 day to represent a single-day event
            // (Google uses end.date as exclusive, so a single-day event on 2026-06-15 has
            // start: "2026-06-15", end: "2026-06-16").
            // end.date is exclusive per the Google Calendar API, so no -1 day fudge -
            // matches the same family-local-midnight conversion CalendarEndpoints already does.
            var endDate = entry.EndDate ?? entry.StartDate.Value.AddDays(1);
            startAtUtc = TimeZoneInfo.ConvertTimeToUtc(
                entry.StartDate.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), familyTimeZone);
            endAtUtc = TimeZoneInfo.ConvertTimeToUtc(
                endDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), familyTimeZone);
        }
        else
        {
            if (entry.StartAtUtc is null || entry.EndAtUtc is null)
            {
                return null;
            }

            // Google already applies the correct offset to dateTime values, so no further
            // timezone conversion is needed for timed events.
            startAtUtc = entry.StartAtUtc.Value;
            endAtUtc = entry.EndAtUtc.Value;
        }

        return new AggregatedEvent(
            entry.GoogleEventId,
            entry.Title,
            entry.Description,
            startAtUtc,
            endAtUtc,
            AssignedProfileId: null,
            Source: "Google",
            SourceLabel: subscription.Summary,
            SourceColorHex: subscription.ColorHex,
            IsAllDay: entry.IsAllDay,
            IsReadOnly: true);
    }
}
