namespace Planner.Infrastructure.Security;

public sealed record EncryptedToken(byte[] Cipher, byte[] Nonce, byte[] Tag, int KeyVersion);

public interface ITokenCipher
{
    EncryptedToken Encrypt(string plaintext);

    string Decrypt(byte[] cipher, byte[] nonce, byte[] tag, int keyVersion);
}
