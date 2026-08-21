using Planner.Domain;

namespace Planner.Infrastructure.Integrations.Google;

public interface IGoogleAccessTokenProvider
{
    // Cache -> refresh -> NeedsReauth on failure. Returns null (and marks the connection
    // NeedsReauth) when the refresh token no longer works; callers own SaveChangesAsync for any
    // connection mutation this causes.
    Task<string?> GetAccessTokenAsync(GoogleCalendarConnection connection, CancellationToken cancellationToken);
}
