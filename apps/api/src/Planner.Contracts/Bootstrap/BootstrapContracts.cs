namespace Planner.Contracts.Bootstrap;

public sealed record BootstrapResponse(
    Guid FamilyId,
    string FamilyName,
    string Timezone,
    IReadOnlyList<ProfileSummary> Profiles,
    IReadOnlyList<MembershipSummary> Memberships,
    MembershipSummary Membership);

public sealed record ProfileSummary(
    Guid Id,
    string DisplayName,
    string ColorKey,
    bool IsActive,
    string? PreferredLanguage,
    string? LinkedUserId);

public sealed record MembershipSummary(string UserId, string Email, string Role, bool CanPlanMeals);
