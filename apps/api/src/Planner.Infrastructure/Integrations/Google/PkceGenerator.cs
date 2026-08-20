using System.Security.Cryptography;
using System.Text;

namespace Planner.Infrastructure.Integrations.Google;

public static class PkceGenerator
{
    public static string GenerateState() => Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    public static string GenerateCodeVerifier() => Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    public static string DeriveCodeChallenge(string codeVerifier)
    {
        var hash = SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier));
        return Base64UrlEncode(hash);
    }

    public static string HashState(string state)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(state));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
