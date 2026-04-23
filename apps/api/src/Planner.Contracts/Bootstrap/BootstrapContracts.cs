namespace Planner.Contracts.Bootstrap;

public sealed record BootstrapResponse(
    Guid FamilyId,
    string FamilyName,
    string Timezone,
    IReadOnlyList<ProfileSummary> Profiles,
    MembershipSummary Membership);

public sealed record ProfileSummary(Guid Id, string DisplayName, string ColorKey, bool IsActive);

public sealed record MembershipSummary(string UserId, string Email, string Role);
