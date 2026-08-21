using Planner.Domain;

namespace Planner.Infrastructure.Integrations.Google;

public interface IGoogleCalendarSubscriptionService
{
    // Upserts connection.Subscriptions against Google's calendarList, preserving IsSelected; callers own SaveChangesAsync.
    Task ReconcileAsync(GoogleCalendarConnection connection, string accessToken, CancellationToken cancellationToken);
}
