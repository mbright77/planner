using Planner.Infrastructure.Integrations.Google;

namespace Planner.ApiTests.Fakes;

public sealed class FakeGoogleOAuthClient : IGoogleOAuthClient
{
    public GoogleTokenResponse? NextExchangeResponse { get; set; }

    public Exception? NextExchangeException { get; set; }

    public GoogleTokenResponse? NextRefreshResponse { get; set; }

    public Exception? NextRefreshException { get; set; }

    public List<(string Code, string CodeVerifier, string RedirectUri)> ExchangeCalls { get; } = [];

    public List<string> RefreshCalls { get; } = [];

    public List<string> RevokedTokens { get; } = [];

    public string BuildAuthorizationUrl(string state, string codeChallenge, string redirectUri)
    {
        return $"https://accounts.google.com/o/oauth2/v2/auth?state={Uri.EscapeDataString(state)}" +
               $"&code_challenge={Uri.EscapeDataString(codeChallenge)}&redirect_uri={Uri.EscapeDataString(redirectUri)}";
    }

    public Task<GoogleTokenResponse> ExchangeCodeAsync(string code, string codeVerifier, string redirectUri, CancellationToken cancellationToken)
    {
        ExchangeCalls.Add((code, codeVerifier, redirectUri));

        if (NextExchangeException is not null)
        {
            throw NextExchangeException;
        }

        if (NextExchangeResponse is null)
        {
            throw new InvalidOperationException("Set FakeGoogleOAuthClient.NextExchangeResponse before triggering a callback in a test.");
        }

        return Task.FromResult(NextExchangeResponse);
    }

    public Task<GoogleTokenResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        RefreshCalls.Add(refreshToken);

        if (NextRefreshException is not null)
        {
            throw NextRefreshException;
        }

        if (NextRefreshResponse is null)
        {
            throw new InvalidOperationException("Set FakeGoogleOAuthClient.NextRefreshResponse before triggering a refresh in a test.");
        }

        return Task.FromResult(NextRefreshResponse);
    }

    public Task RevokeAsync(string token, CancellationToken cancellationToken)
    {
        RevokedTokens.Add(token);
        return Task.CompletedTask;
    }

    // The factory holds one instance of this fake for the lifetime of the test class (shared
    // across every [Fact]), so tests must reset it explicitly instead of relying on a fresh one.
    public void Reset()
    {
        NextExchangeResponse = null;
        NextExchangeException = null;
        NextRefreshResponse = null;
        NextRefreshException = null;
        ExchangeCalls.Clear();
        RefreshCalls.Clear();
        RevokedTokens.Clear();
    }
}
