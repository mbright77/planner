using System.Security.Cryptography;
using System.Text;
using Planner.Infrastructure.Integrations.Google;

namespace Planner.UnitTests;

public class PkceGeneratorTests
{
    [Fact]
    public void DeriveCodeChallenge_matches_a_manual_S256_computation()
    {
        const string verifier = "test-code-verifier-1234567890abcdefghijk";
        var expected = Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));

        var actual = PkceGenerator.DeriveCodeChallenge(verifier);

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void GenerateState_and_GenerateCodeVerifier_produce_unique_url_safe_values()
    {
        var state1 = PkceGenerator.GenerateState();
        var state2 = PkceGenerator.GenerateState();
        var verifier = PkceGenerator.GenerateCodeVerifier();

        Assert.NotEqual(state1, state2);
        Assert.DoesNotContain('+', state1 + verifier);
        Assert.DoesNotContain('/', state1 + verifier);
        Assert.DoesNotContain('=', state1 + verifier);
    }

    [Fact]
    public void HashState_is_deterministic_and_lowercase_hex()
    {
        const string state = "some-state-value";

        var hash1 = PkceGenerator.HashState(state);
        var hash2 = PkceGenerator.HashState(state);

        Assert.Equal(hash1, hash2);
        Assert.Matches("^[0-9a-f]{64}$", hash1);
    }

    [Fact]
    public void HashState_differs_for_different_inputs()
    {
        var hashA = PkceGenerator.HashState("state-a");
        var hashB = PkceGenerator.HashState("state-b");

        Assert.NotEqual(hashA, hashB);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
