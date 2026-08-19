using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Planner.Infrastructure.Integrations.Google;

namespace Planner.Infrastructure.Security;

public sealed class AesGcmTokenCipher : ITokenCipher
{
    private const int NonceSizeBytes = 12;
    private const int TagSizeBytes = 16;
    private const int KeySizeBytes = 32;

    private readonly byte[] _key;
    private readonly int _keyVersion;

    public AesGcmTokenCipher(IOptions<GoogleOptions> options)
    {
        var googleOptions = options.Value;

        byte[] key;
        try
        {
            key = Convert.FromBase64String(googleOptions.TokenEncryptionKey);
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

        _key = key;
        _keyVersion = googleOptions.TokenEncryptionKeyVersion;
    }

    public EncryptedToken Encrypt(string plaintext)
    {
        ArgumentNullException.ThrowIfNull(plaintext);

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(NonceSizeBytes);
        var cipherBytes = new byte[plaintextBytes.Length];
        var tag = new byte[TagSizeBytes];

        using (var aesGcm = new AesGcm(_key, TagSizeBytes))
        {
            aesGcm.Encrypt(nonce, plaintextBytes, cipherBytes, tag);
        }

        return new EncryptedToken(cipherBytes, nonce, tag, _keyVersion);
    }

    public string Decrypt(byte[] cipher, byte[] nonce, byte[] tag, int keyVersion)
    {
        ArgumentNullException.ThrowIfNull(cipher);
        ArgumentNullException.ThrowIfNull(nonce);
        ArgumentNullException.ThrowIfNull(tag);

        if (keyVersion != _keyVersion)
        {
            throw new CryptographicException(
                $"No decryption key is registered for key version {keyVersion} (current version is {_keyVersion}).");
        }

        var plaintextBytes = new byte[cipher.Length];

        using (var aesGcm = new AesGcm(_key, TagSizeBytes))
        {
            aesGcm.Decrypt(nonce, cipher, tag, plaintextBytes);
        }

        return Encoding.UTF8.GetString(plaintextBytes);
    }
}
