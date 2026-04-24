namespace Planner.Contracts.Profiles;

public sealed record ProfileResponse(Guid Id, string DisplayName, string ColorKey, bool IsActive, bool HasLogin);

public sealed record CreateProfileRequest(string DisplayName, string ColorKey);

public sealed record UpdateProfileRequest(string DisplayName, string ColorKey, bool IsActive);
