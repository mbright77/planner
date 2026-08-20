using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Planner.Infrastructure.Integrations.Google;

namespace Planner.Infrastructure.Security;

public sealed class AesGcmTokenCipher(IOptions<GoogleOptions> options) : ITokenCipher
{
    private const int NonceSizeBytes = 12;
    private const int TagSizeBytes = 16;
    private const int KeySizeBytes = 32;

    private readonly GoogleOptions _options = options.Value;

    public EncryptedToken Encrypt(string plaintext)
    {
        ArgumentNullException.ThrowIfNull(plaintext);

        var key = ResolveKey();
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(NonceSizeBytes);
        var cipherBytes = new byte[plaintextBytes.Length];
        var tag = new byte[TagSizeBytes];

        using (var aesGcm = new AesGcm(key, TagSizeBytes))
        {
            aesGcm.Encrypt(nonce, plaintextBytes, cipherBytes, tag);
        }

        return new EncryptedToken(cipherBytes, nonce, tag, _options.TokenEncryptionKeyVersion);
    }

    public string Decrypt(byte[] cipher, byte[] nonce, byte[] tag, int keyVersion)
    {
        ArgumentNullException.ThrowIfNull(cipher);
        ArgumentNullException.ThrowIfNull(nonce);
        ArgumentNullException.ThrowIfNull(tag);

        if (keyVersion != _options.TokenEncryptionKeyVersion)
        {
            throw new CryptographicException(
                $"No decryption key is registered for key version {keyVersion} (current version is {_options.TokenEncryptionKeyVersion}).");
        }

        var key = ResolveKey();
        var plaintextBytes = new byte[cipher.Length];

        using (var aesGcm = new AesGcm(key, TagSizeBytes))
        {
            aesGcm.Decrypt(nonce, cipher, tag, plaintextBytes);
        }

        return Encoding.UTF8.GetString(plaintextBytes);
    }

    // Deliberately not resolved in the constructor: this cipher is DI-resolved as an endpoint
    // parameter on routes reachable even when Google integration is unconfigured (blank key),
    // and minimal API binds parameters before the handler body's own guard clauses ever run.
    private byte[] ResolveKey()
    {
        byte[] key;
        try
        {
            key = Convert.FromBase64String(_options.TokenEncryptionKey);
        }
        catch (FormatException exception)
        {
            throw new InvalidOperationException(
                "Google:TokenEncryptionKey must be a base64-encoded 32-byte AES-256 key.", exception);
        }

        if (key.Length != KeySizeBytes)
        {
            throw new InvalidOperationException(
                $"Google:TokenEncryptionKey must decode to exactly {KeySizeBytes} bytes for AES-256, but decoded to {key.Length}.");
        }

        return key;
    }
}
