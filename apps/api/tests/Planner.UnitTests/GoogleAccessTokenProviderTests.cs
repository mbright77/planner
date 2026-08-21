using System.Security.Cryptography;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Planner.Domain;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Security;

namespace Planner.UnitTests;

public class GoogleAccessTokenProviderTests
{
    private static ITokenCipher CreateCipher()
    {
        var options = new GoogleOptions
        {
            TokenEncryptionKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
            TokenEncryptionKeyVersion = 1,
        };

        return new AesGcmTokenCipher(Options.Create(options));
    }

    private static GoogleCalendarConnection CreateConnection(ITokenCipher cipher)
    {
        var connection = new GoogleCalendarConnection { Id = Guid.NewGuid(), Status = GoogleConnectionStatus.Connected };
        GoogleRefreshTokenWriter.UpdateRefreshToken(connection, "stored-refresh-token", cipher);
        return connection;
    }

    private static GoogleAccessTokenProvider CreateProvider(IMemoryCache cache, FakeGoogleOAuthClient oAuthClient, ITokenCipher cipher) =>
        new(cache, oAuthClient, cipher, NullLogger<GoogleAccessTokenProvider>.Instance);

    [Fact]
    public async Task GetAccessTokenAsync_refreshes_and_caches_on_a_cold_cache()
    {
        var cipher = CreateCipher();
        var connection = CreateConnection(cipher);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var oAuthClient = new FakeGoogleOAuthClient { NextRefreshResponse = new GoogleTokenResponse("fresh-token", null, 3600, null, "scope") };
        var provider = CreateProvider(cache, oAuthClient, cipher);

        var token = await provider.GetAccessTokenAsync(connection, CancellationToken.None);

        Assert.Equal("fresh-token", token);
        Assert.Equal(GoogleConnectionStatus.Connected, connection.Status);
        Assert.Equal(["stored-refresh-token"], oAuthClient.RefreshCalls);
    }

    [Fact]
    public async Task GetAccessTokenAsync_returns_the_cached_token_without_calling_google_again()
    {
        var cipher = CreateCipher();
        var connection = CreateConnection(cipher);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var oAuthClient = new FakeGoogleOAuthClient { NextRefreshResponse = new GoogleTokenResponse("fresh-token", null, 3600, null, "scope") };
        var provider = CreateProvider(cache, oAuthClient, cipher);

        var first = await provider.GetAccessTokenAsync(connection, CancellationToken.None);
        var second = await provider.GetAccessTokenAsync(connection, CancellationToken.None);

        Assert.Equal("fresh-token", first);
        Assert.Equal("fresh-token", second);
        Assert.Single(oAuthClient.RefreshCalls);
    }

    [Fact]
    public async Task GetAccessTokenAsync_marks_needs_reauth_and_returns_null_when_refresh_fails()
    {
        var cipher = CreateCipher();
        var connection = CreateConnection(cipher);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var oAuthClient = new FakeGoogleOAuthClient { NextRefreshException = new InvalidOperationException("invalid_grant") };
        var provider = CreateProvider(cache, oAuthClient, cipher);

        var token = await provider.GetAccessTokenAsync(connection, CancellationToken.None);

        Assert.Null(token);
        Assert.Equal(GoogleConnectionStatus.NeedsReauth, connection.Status);
        Assert.NotNull(connection.LastErrorAtUtc);
        Assert.Equal("invalid_grant", connection.LastError);
    }

    [Fact]
    public async Task GetAccessTokenAsync_skips_the_google_call_when_already_needs_reauth()
    {
        var cipher = CreateCipher();
        var connection = CreateConnection(cipher);
        connection.Status = GoogleConnectionStatus.NeedsReauth;
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var oAuthClient = new FakeGoogleOAuthClient();
        var provider = CreateProvider(cache, oAuthClient, cipher);

        var token = await provider.GetAccessTokenAsync(connection, CancellationToken.None);

        Assert.Null(token);
        Assert.Empty(oAuthClient.RefreshCalls);
    }

    [Fact]
    public async Task GetAccessTokenAsync_propagates_cancellation_without_marking_needs_reauth()
    {
        var cipher = CreateCipher();
        var connection = CreateConnection(cipher);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var oAuthClient = new FakeGoogleOAuthClient { NextRefreshException = new OperationCanceledException() };
        var provider = CreateProvider(cache, oAuthClient, cipher);

        await Assert.ThrowsAsync<OperationCanceledException>(
            () => provider.GetAccessTokenAsync(connection, CancellationToken.None));

        Assert.Equal(GoogleConnectionStatus.Connected, connection.Status);
    }

    private sealed class FakeGoogleOAuthClient : IGoogleOAuthClient
    {
        public GoogleTokenResponse? NextRefreshResponse { get; set; }

        public Exception? NextRefreshException { get; set; }

        public List<string> RefreshCalls { get; } = [];

        public string BuildAuthorizationUrl(string state, string codeChallenge, string redirectUri) =>
            throw new NotSupportedException();

        public Task<GoogleTokenResponse> ExchangeCodeAsync(string code, string codeVerifier, string redirectUri, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<GoogleTokenResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
        {
            RefreshCalls.Add(refreshToken);

            if (NextRefreshException is not null)
            {
                throw NextRefreshException;
            }

            return Task.FromResult(NextRefreshResponse ?? throw new InvalidOperationException("Set NextRefreshResponse first."));
        }

        public Task RevokeAsync(string token, CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
