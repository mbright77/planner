using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Security;

namespace Planner.UnitTests;

public class AesGcmTokenCipherTests
{
    private static AesGcmTokenCipher CreateCipher(string? key = null, int keyVersion = 1)
    {
        var options = new GoogleOptions
        {
            TokenEncryptionKey = key ?? Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
            TokenEncryptionKeyVersion = keyVersion,
        };

        return new AesGcmTokenCipher(Options.Create(options));
    }

    [Fact]
    public void Encrypt_then_decrypt_round_trips_the_plaintext()
    {
        var cipher = CreateCipher();
        const string plaintext = "1//0gExampleGoogleRefreshToken";

        var encrypted = cipher.Encrypt(plaintext);
        var decrypted = cipher.Decrypt(encrypted.Cipher, encrypted.Nonce, encrypted.Tag, encrypted.KeyVersion);

        Assert.Equal(plaintext, decrypted);
    }

    [Fact]
    public void Decrypt_throws_when_ciphertext_has_been_tampered_with()
    {
        var cipher = CreateCipher();
        var encrypted = cipher.Encrypt("refresh-token-value");

        var tamperedCipher = (byte[])encrypted.Cipher.Clone();
        tamperedCipher[0] ^= 0xFF;

        Assert.Throws<AuthenticationTagMismatchException>(
            () => cipher.Decrypt(tamperedCipher, encrypted.Nonce, encrypted.Tag, encrypted.KeyVersion));
    }

    [Fact]
    public void Decrypt_throws_when_the_tag_has_been_tampered_with()
    {
        var cipher = CreateCipher();
        var encrypted = cipher.Encrypt("refresh-token-value");

        var tamperedTag = (byte[])encrypted.Tag.Clone();
        tamperedTag[0] ^= 0xFF;

        Assert.Throws<AuthenticationTagMismatchException>(
            () => cipher.Decrypt(encrypted.Cipher, encrypted.Nonce, tamperedTag, encrypted.KeyVersion));
    }

    [Fact]
    public void Decrypt_throws_when_using_the_wrong_key()
    {
        var encryptingCipher = CreateCipher();
        var decryptingCipher = CreateCipher();
        var encrypted = encryptingCipher.Encrypt("refresh-token-value");

        Assert.Throws<AuthenticationTagMismatchException>(
            () => decryptingCipher.Decrypt(encrypted.Cipher, encrypted.Nonce, encrypted.Tag, encrypted.KeyVersion));
    }

    [Fact]
    public void Decrypt_throws_when_key_version_does_not_match_the_active_key()
    {
        var cipher = CreateCipher(keyVersion: 1);
        var encrypted = cipher.Encrypt("refresh-token-value");

        Assert.Throws<CryptographicException>(
            () => cipher.Decrypt(encrypted.Cipher, encrypted.Nonce, encrypted.Tag, keyVersion: 2));
    }

    [Fact]
    public void Encrypt_throws_when_key_is_not_32_bytes()
    {
        var shortKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        var cipher = CreateCipher(shortKey);

        Assert.Throws<InvalidOperationException>(() => cipher.Encrypt("plaintext"));
    }

    [Fact]
    public void Encrypt_throws_when_key_is_not_valid_base64()
    {
        var cipher = CreateCipher("not-valid-base64!!");

        Assert.Throws<InvalidOperationException>(() => cipher.Encrypt("plaintext"));
    }

    [Fact]
    public void Decrypt_throws_when_key_is_not_32_bytes()
    {
        // ResolveKey() is called independently from Encrypt and Decrypt (see the comment on
        // that method), so this path needs its own coverage rather than relying on the Encrypt
        // tests above.
        var shortKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        var tokenCipher = CreateCipher(shortKey);

        Assert.Throws<InvalidOperationException>(
            () => tokenCipher.Decrypt([1, 2, 3], [4, 5, 6], [7, 8, 9], keyVersion: 1));
    }

    [Fact]
    public void Constructing_with_a_blank_key_does_not_throw()
    {
        // Endpoints resolve ITokenCipher via DI even on routes reachable while Google is
        // unconfigured; construction must stay side-effect-free so those routes don't 500.
        var cipher = CreateCipher(string.Empty);

        Assert.NotNull(cipher);
    }
}
