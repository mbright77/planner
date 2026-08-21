using Planner.Domain;
using Planner.Infrastructure.Persistence;

namespace Planner.Infrastructure.Integrations.Google;

public sealed class GoogleCalendarSubscriptionService(PlannerDbContext dbContext, IGoogleCalendarClient calendarClient)
    : IGoogleCalendarSubscriptionService
{
    public async Task ReconcileAsync(GoogleCalendarConnection connection, string accessToken, CancellationToken cancellationToken)
    {
        var googleCalendars = await calendarClient.ListCalendarsAsync(accessToken, cancellationToken);
        var googleIds = googleCalendars.Select(x => x.GoogleCalendarId).ToHashSet();
        var now = DateTimeOffset.UtcNow;

        // Kept in sync as we go (not just seeded once): Google's calendarList.list paginates,
        // and if the same id somehow appeared on two pages, an unsynced dictionary would let a
        // second insert through and violate the (ConnectionId, GoogleCalendarId) unique index.
        var existingByGoogleId = connection.Subscriptions.ToDictionary(x => x.GoogleCalendarId);

        foreach (var googleCalendar in googleCalendars)
        {
            if (existingByGoogleId.TryGetValue(googleCalendar.GoogleCalendarId, out var subscription))
            {
                subscription.Summary = googleCalendar.Summary;
                subscription.Description = googleCalendar.Description;
                subscription.ColorHex = googleCalendar.ColorHex;
                subscription.TimeZone = googleCalendar.TimeZone;
                subscription.AccessRole = googleCalendar.AccessRole;
                subscription.IsPrimary = googleCalendar.IsPrimary;
                subscription.LastSeenAtUtc = now;
            }
            else
            {
                var newSubscription = new GoogleCalendarSubscription
                {
                    Id = Guid.NewGuid(),
                    ConnectionId = connection.Id,
                    GoogleCalendarId = googleCalendar.GoogleCalendarId,
                    Summary = googleCalendar.Summary,
                    Description = googleCalendar.Description,
                    ColorHex = googleCalendar.ColorHex,
                    TimeZone = googleCalendar.TimeZone,
                    AccessRole = googleCalendar.AccessRole,
                    IsPrimary = googleCalendar.IsPrimary,
                    IsSelected = false,
                    LastSeenAtUtc = now,
                };

                // EF's change-tracker fixup already adds this to connection.Subscriptions once
                // Add() below runs (connection is tracked with Subscriptions loaded and the FK
                // matches) - adding it here too would leave the same entity referenced twice in
                // the in-memory list, which is exactly the duplicate this dictionary exists to
                // prevent, just introduced a different way.
                dbContext.GoogleCalendarSubscriptions.Add(newSubscription);
                existingByGoogleId[newSubscription.GoogleCalendarId] = newSubscription;
            }
        }

        foreach (var subscription in connection.Subscriptions.Where(x => !googleIds.Contains(x.GoogleCalendarId)).ToList())
        {
            // Unlike Add's fixup (see above), removing from the DbSet doesn't synchronously drop
            // the entity from connection.Subscriptions - it's still visible in-memory until the
            // next full reload, so it must be removed from both explicitly.
            dbContext.GoogleCalendarSubscriptions.Remove(subscription);
            connection.Subscriptions.Remove(subscription);
        }

        connection.CalendarsSyncedAtUtc = now;
    }
}
