using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Planner.Infrastructure.Integrations.Google;

public sealed class GoogleOAuthClient(HttpClient httpClient, IOptions<GoogleOptions> options) : IGoogleOAuthClient
{
    private const string AuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
    private const string TokenEndpoint = "https://oauth2.googleapis.com/token";
    private const string RevokeEndpoint = "https://oauth2.googleapis.com/revoke";

    private const string Scopes =
        "https://www.googleapis.com/auth/calendar.events.readonly " +
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly " +
        "openid email";

    private readonly GoogleOptions _options = options.Value;

    public string BuildAuthorizationUrl(string state, string codeChallenge, string redirectUri)
    {
        var query = new Dictionary<string, string>
        {
            ["client_id"] = _options.ClientId,
            ["redirect_uri"] = redirectUri,
            ["response_type"] = "code",
            ["scope"] = Scopes,
            ["access_type"] = "offline",
            ["prompt"] = "consent",
            ["code_challenge"] = codeChallenge,
            ["code_challenge_method"] = "S256",
            ["state"] = state,
        };

        var queryString = string.Join(
            "&", query.Select(kvp => $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value)}"));

        return $"{AuthorizationEndpoint}?{queryString}";
    }

    public Task<GoogleTokenResponse> ExchangeCodeAsync(string code, string codeVerifier, string redirectUri, CancellationToken cancellationToken)
    {
        var form = new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code",
            ["code_verifier"] = codeVerifier,
        };

        return PostTokenRequestAsync(form, cancellationToken);
    }

    public Task<GoogleTokenResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var form = new Dictionary<string, string>
        {
            ["refresh_token"] = refreshToken,
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["grant_type"] = "refresh_token",
        };

        return PostTokenRequestAsync(form, cancellationToken);
    }

    public async Task RevokeAsync(string token, CancellationToken cancellationToken)
    {
        using var content = new FormUrlEncodedContent(new Dictionary<string, string> { ["token"] = token });
        using var response = await httpClient.PostAsync(RevokeEndpoint, content, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    private async Task<GoogleTokenResponse> PostTokenRequestAsync(Dictionary<string, string> form, CancellationToken cancellationToken)
    {
        using var content = new FormUrlEncodedContent(form);
        using var response = await httpClient.PostAsync(TokenEndpoint, content, cancellationToken);
        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<GoogleTokenPayload>(cancellationToken)
            ?? throw new InvalidOperationException("Google token endpoint returned an empty response.");

        if (string.IsNullOrEmpty(payload.AccessToken))
        {
            throw new InvalidOperationException("Google token response was missing access_token.");
        }

        return new GoogleTokenResponse(payload.AccessToken, payload.RefreshToken, payload.ExpiresIn, payload.IdToken, payload.Scope);
    }

    private sealed record GoogleTokenPayload(
        [property: JsonPropertyName("access_token")] string? AccessToken,
        [property: JsonPropertyName("refresh_token")] string? RefreshToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn,
        [property: JsonPropertyName("id_token")] string? IdToken,
        [property: JsonPropertyName("scope")] string? Scope);
}
