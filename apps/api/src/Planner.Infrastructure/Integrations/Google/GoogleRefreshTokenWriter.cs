using Planner.Domain;
using Planner.Infrastructure.Security;

namespace Planner.Infrastructure.Integrations.Google;

public static class GoogleRefreshTokenWriter
{
    public static void UpdateRefreshToken(GoogleCalendarConnection connection, string? refreshToken, ITokenCipher tokenCipher)
    {
        if (string.IsNullOrEmpty(refreshToken))
        {
            return;
        }

        var encrypted = tokenCipher.Encrypt(refreshToken);
        connection.RefreshTokenCipher = encrypted.Cipher;
        connection.RefreshTokenNonce = encrypted.Nonce;
        connection.RefreshTokenTag = encrypted.Tag;
        connection.KeyVersion = encrypted.KeyVersion;
    }
}
