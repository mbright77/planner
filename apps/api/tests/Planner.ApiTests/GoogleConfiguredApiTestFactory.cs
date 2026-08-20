using System.Security.Cryptography;

namespace Planner.ApiTests;

public sealed class GoogleConfiguredApiTestFactory : ApiTestFactory
{
    public string TokenEncryptionKeyBase64 { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    public const string RedirectUri = "http://localhost/api/v1/integrations/google/callback";

    public const string PostConnectRedirectUrl = "http://localhost/app/";

    protected override IDictionary<string, string?> GoogleConfigurationOverrides => new Dictionary<string, string?>
    {
        ["Google:ClientId"] = "test-client-id",
        ["Google:ClientSecret"] = "test-client-secret",
        ["Google:TokenEncryptionKey"] = TokenEncryptionKeyBase64,
        ["Google:RedirectUri"] = RedirectUri,
        ["Google:PostConnectRedirectUrl"] = PostConnectRedirectUrl,
    };
}
