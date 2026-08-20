using System.Security.Cryptography;
using Planner.Infrastructure.Integrations.Google;

namespace Planner.UnitTests;

public class GoogleOptionsTests
{
    [Fact]
    public void HasValidPostConnectRedirectUrl_is_true_when_unconfigured_regardless_of_the_url()
    {
        var options = new GoogleOptions { PostConnectRedirectUrl = "not-a-url" };

        Assert.False(options.IsConfigured);
        Assert.True(options.HasValidPostConnectRedirectUrl);
    }

    [Fact]
    public void HasValidPostConnectRedirectUrl_is_true_when_configured_with_an_absolute_url()
    {
        var options = new GoogleOptions
        {
            ClientId = "id",
            ClientSecret = "secret",
            PostConnectRedirectUrl = "https://example.com/app/",
        };

        Assert.True(options.HasValidPostConnectRedirectUrl);
    }

    [Theory]
    [InlineData("")]
    [InlineData("/relative/path")]
    [InlineData("not-a-url")]
    public void HasValidPostConnectRedirectUrl_is_false_when_configured_without_an_absolute_url(string invalidUrl)
    {
        var options = new GoogleOptions
        {
            ClientId = "id",
            ClientSecret = "secret",
            PostConnectRedirectUrl = invalidUrl,
        };

        Assert.False(options.HasValidPostConnectRedirectUrl);
    }

    [Fact]
    public void HasValidTokenEncryptionKey_is_true_when_unconfigured_regardless_of_the_key()
    {
        var options = new GoogleOptions { TokenEncryptionKey = "not-base64!!" };

        Assert.False(options.IsConfigured);
        Assert.True(options.HasValidTokenEncryptionKey);
    }

    [Fact]
    public void HasValidTokenEncryptionKey_is_true_when_configured_with_a_valid_32_byte_key()
    {
        var options = new GoogleOptions
        {
            ClientId = "id",
            ClientSecret = "secret",
            TokenEncryptionKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
        };

        Assert.True(options.HasValidTokenEncryptionKey);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-valid-base64!!")]
    public void HasValidTokenEncryptionKey_is_false_when_configured_with_a_bad_key(string invalidKey)
    {
        var options = new GoogleOptions
        {
            ClientId = "id",
            ClientSecret = "secret",
            TokenEncryptionKey = invalidKey,
        };

        Assert.False(options.HasValidTokenEncryptionKey);
    }

    [Fact]
    public void HasValidTokenEncryptionKey_is_false_when_configured_with_the_wrong_length()
    {
        var options = new GoogleOptions
        {
            ClientId = "id",
            ClientSecret = "secret",
            TokenEncryptionKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16)),
        };

        Assert.False(options.HasValidTokenEncryptionKey);
    }
}
