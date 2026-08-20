using Microsoft.Extensions.Logging;
using Planner.Domain;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Security;

namespace Planner.Api.Endpoints;

internal static class GoogleConnectionCleanup
{
    public static async Task TryRevokeAsync(
        GoogleCalendarConnection connection,
        IGoogleOAuthClient oAuthClient,
        ITokenCipher tokenCipher,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            var refreshToken = tokenCipher.Decrypt(
                connection.RefreshTokenCipher, connection.RefreshTokenNonce, connection.RefreshTokenTag, connection.KeyVersion);
            await oAuthClient.RevokeAsync(refreshToken, cancellationToken);
        }
        catch (Exception exception)
        {
            // Best-effort: callers proceed with local cleanup even if revocation fails or the
            // stored token can't be decrypted (e.g. a rotated encryption key) - but log it, since
            // a silent failure here means a refresh-token grant stays live at Google forever.
            logger.LogWarning(
                exception, "Failed to revoke Google connection {ConnectionId} at Google.", connection.Id);
        }
    }
}
