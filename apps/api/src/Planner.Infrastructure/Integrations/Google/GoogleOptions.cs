namespace Planner.Infrastructure.Integrations.Google;

public sealed class GoogleOptions
{
    public const string SectionName = "Google";

    public string ClientId { get; set; } = string.Empty;

    public string ClientSecret { get; set; } = string.Empty;

    public string RedirectUri { get; set; } = string.Empty;

    public string PostConnectRedirectUrl { get; set; } = string.Empty;

    public string TokenEncryptionKey { get; set; } = string.Empty;

    public int TokenEncryptionKeyVersion { get; set; } = 1;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);

    // Uri.TryCreate(..., UriKind.Absolute, ...) alone accepts bare paths like "/foo" as valid
    // (implicit file:// URIs), so the scheme must be checked explicitly too.
    public bool HasValidPostConnectRedirectUrl =>
        !IsConfigured
        || (Uri.TryCreate(PostConnectRedirectUrl, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps));

    // AesGcmTokenCipher validates this lazily (see its comment for why), but a broken key should
    // still fail app startup rather than the first real user's OAuth callback.
    public bool HasValidTokenEncryptionKey
    {
        get
        {
            if (!IsConfigured)
            {
                return true;
            }

            try
            {
                return Convert.FromBase64String(TokenEncryptionKey).Length == 32;
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}
