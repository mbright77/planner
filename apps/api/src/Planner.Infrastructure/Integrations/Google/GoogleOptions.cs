namespace Planner.Infrastructure.Integrations.Google;

public sealed class GoogleOptions
{
    public const string SectionName = "Google";

    public string TokenEncryptionKey { get; set; } = string.Empty;

    public int TokenEncryptionKeyVersion { get; set; } = 1;
}
