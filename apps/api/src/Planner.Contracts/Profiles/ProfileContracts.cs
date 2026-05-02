namespace Planner.Contracts.Profiles;

public sealed record ProfileResponse(
    Guid Id,
    string DisplayName,
    string ColorKey,
    bool IsActive,
    bool HasLogin,
    string? PreferredLanguage,
    string? LinkedUserId);

public sealed record CreateProfileRequest(string DisplayName, string ColorKey, string? PreferredLanguage = null);

public sealed record UpdateProfileRequest(string DisplayName, string ColorKey, bool IsActive, string? PreferredLanguage = null);
