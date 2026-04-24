namespace Planner.Contracts.Invites;

public sealed record FamilyInviteResponse(
    Guid Id,
    string Email,
    string Token,
    DateTimeOffset ExpiresAtUtc,
    DateTimeOffset CreatedAtUtc,
    bool IsAccepted,
    Guid? ProfileId,
    string? ProfileDisplayName);

public sealed record CreateFamilyInviteRequest(string Email, Guid? ProfileId);

public sealed record AcceptFamilyInviteRequest(
    string Email,
    string Password,
    string? DisplayName,
    string? ColorKey);

public sealed record FamilyInviteDetailsResponse(
    string Email,
    string FamilyName,
    DateTimeOffset ExpiresAtUtc,
    bool IsExpired,
    bool IsAccepted,
    Guid? ProfileId,
    string? ProfileDisplayName,
    string? ProfileColorKey);
