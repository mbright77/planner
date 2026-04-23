using Planner.Infrastructure.Identity;

namespace Planner.Infrastructure.Auth;

public interface IJwtTokenService
{
    (string AccessToken, DateTimeOffset ExpiresAtUtc) CreateAccessToken(
        PlannerIdentityUser user,
        Guid familyId,
        string role);
}
