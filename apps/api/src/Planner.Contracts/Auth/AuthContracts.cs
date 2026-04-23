namespace Planner.Contracts.Auth;

public sealed record RegisterRequest(
    string Email,
    string Password,
    string FamilyName,
    string DisplayName,
    string Timezone,
    string ColorKey);

public sealed record LoginRequest(string Email, string Password);

public sealed record AuthResponse(string AccessToken, DateTimeOffset ExpiresAtUtc);
