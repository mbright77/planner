namespace Planner.Infrastructure.Integrations.Google;

public interface IGoogleOAuthClient
{
    string BuildAuthorizationUrl(string state, string codeChallenge, string redirectUri);

    Task<GoogleTokenResponse> ExchangeCodeAsync(string code, string codeVerifier, string redirectUri, CancellationToken cancellationToken);

    Task<GoogleTokenResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken);

    Task RevokeAsync(string token, CancellationToken cancellationToken);
}
