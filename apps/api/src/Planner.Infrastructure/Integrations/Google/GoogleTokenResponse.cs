namespace Planner.Infrastructure.Integrations.Google;

public sealed record GoogleTokenResponse(
    string AccessToken,
    string? RefreshToken,
    int ExpiresInSeconds,
    string? IdToken,
    string? Scope);
