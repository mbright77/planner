using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Planner.Domain;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Security;

namespace Planner.UnitTests;

public class GoogleRefreshTokenWriterTests
{
    private static ITokenCipher CreateCipher()
    {
        var options = new GoogleOptions
        {
            TokenEncryptionKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
            TokenEncryptionKeyVersion = 1,
        };

        return new AesGcmTokenCipher(Options.Create(options));
    }

    [Fact]
    public void UpdateRefreshToken_encrypts_and_stores_a_present_token()
    {
        var cipher = CreateCipher();
        var connection = new GoogleCalendarConnection();

        GoogleRefreshTokenWriter.UpdateRefreshToken(connection, "new-refresh-token", cipher);

        var decrypted = cipher.Decrypt(
            connection.RefreshTokenCipher, connection.RefreshTokenNonce, connection.RefreshTokenTag, connection.KeyVersion);
        Assert.Equal("new-refresh-token", decrypted);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void UpdateRefreshToken_keeps_the_existing_token_when_the_response_omits_it(string? missingToken)
    {
        var cipher = CreateCipher();
        var connection = new GoogleCalendarConnection();
        GoogleRefreshTokenWriter.UpdateRefreshToken(connection, "original-token", cipher);

        var cipherBefore = connection.RefreshTokenCipher;
        var nonceBefore = connection.RefreshTokenNonce;
        var tagBefore = connection.RefreshTokenTag;

        GoogleRefreshTokenWriter.UpdateRefreshToken(connection, missingToken, cipher);

        Assert.Equal(cipherBefore, connection.RefreshTokenCipher);
        Assert.Equal(nonceBefore, connection.RefreshTokenNonce);
        Assert.Equal(tagBefore, connection.RefreshTokenTag);

        var decrypted = cipher.Decrypt(
            connection.RefreshTokenCipher, connection.RefreshTokenNonce, connection.RefreshTokenTag, connection.KeyVersion);
        Assert.Equal("original-token", decrypted);
    }

    [Fact]
    public void UpdateRefreshToken_replaces_the_token_when_a_new_one_is_present()
    {
        var cipher = CreateCipher();
        var connection = new GoogleCalendarConnection();
        GoogleRefreshTokenWriter.UpdateRefreshToken(connection, "original-token", cipher);

        GoogleRefreshTokenWriter.UpdateRefreshToken(connection, "replacement-token", cipher);

        var decrypted = cipher.Decrypt(
            connection.RefreshTokenCipher, connection.RefreshTokenNonce, connection.RefreshTokenTag, connection.KeyVersion);
        Assert.Equal("replacement-token", decrypted);
    }
}
