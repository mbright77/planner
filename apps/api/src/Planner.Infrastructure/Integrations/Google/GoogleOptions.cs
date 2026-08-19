namespace Planner.Infrastructure.Integrations.Google;

public sealed class GoogleOptions
{
    public const string SectionName = "Google";

    public string ClientId { get; set; } = string.Empty;

    public string ClientSecret { get; set; } = string.Empty;

    public string TokenEncryptionKey { get; set; } = string.Empty;

    public int TokenEncryptionKeyVersion { get; set; } = 1;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}
