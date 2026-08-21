using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Planner.Domain;
using Planner.Infrastructure.Security;

namespace Planner.Infrastructure.Integrations.Google;

public sealed class GoogleAccessTokenProvider(
    IMemoryCache cache,
    IGoogleOAuthClient oAuthClient,
    ITokenCipher tokenCipher,
    ILogger<GoogleAccessTokenProvider> logger) : IGoogleAccessTokenProvider
{
    // Leaves a safety margin so a token doesn't expire mid-flight on the request that reads it
    // back from cache; the floor keeps an unusually short-lived Google response from producing a
    // negative or near-zero TTL.
    private const int ExpiryMarginSeconds = 60;
    private const int MinimumCacheSeconds = 30;

    public async Task<string?> GetAccessTokenAsync(GoogleCalendarConnection connection, CancellationToken cancellationToken)
    {
        // A connection already known to need reauth has a refresh token that will just fail
        // again - skip the round trip rather than hammering Google on every calendar read.
        if (connection.Status == GoogleConnectionStatus.NeedsReauth)
        {
            return null;
        }

        var cacheKey = CacheKey(connection.Id);
        if (cache.TryGetValue<string>(cacheKey, out var cached) && cached is not null)
        {
            return cached;
        }

        try
        {
            var refreshToken = tokenCipher.Decrypt(
                connection.RefreshTokenCipher, connection.RefreshTokenNonce, connection.RefreshTokenTag, connection.KeyVersion);
            var tokenResponse = await oAuthClient.RefreshAsync(refreshToken, cancellationToken);

            GoogleRefreshTokenWriter.UpdateRefreshToken(connection, tokenResponse.RefreshToken, tokenCipher);
            connection.Status = GoogleConnectionStatus.Connected;
            connection.LastErrorAtUtc = null;
            connection.LastError = null;

            var ttlSeconds = Math.Max(tokenResponse.ExpiresInSeconds - ExpiryMarginSeconds, MinimumCacheSeconds);
            cache.Set(cacheKey, tokenResponse.AccessToken, TimeSpan.FromSeconds(ttlSeconds));

            return tokenResponse.AccessToken;
        }
        catch (OperationCanceledException)
        {
            // Not a Google auth failure - let it propagate instead of marking a healthy
            // connection NeedsReauth over a client disconnect or request cancellation.
            throw;
        }
        catch (Exception exception)
        {
            connection.Status = GoogleConnectionStatus.NeedsReauth;
            connection.LastErrorAtUtc = DateTimeOffset.UtcNow;
            connection.LastError = exception.Message;
            logger.LogWarning(exception, "Failed to refresh the Google access token for connection {ConnectionId}.", connection.Id);

            return null;
        }
    }

    private static string CacheKey(Guid connectionId) => $"google-access-token:{connectionId}";
}
