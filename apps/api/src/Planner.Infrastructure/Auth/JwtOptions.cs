namespace Planner.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "planner-api";

    public string Audience { get; set; } = "planner-web";

    public string SigningKey { get; set; } = "development-signing-key-change-me";

    public int AccessTokenMinutes { get; set; } = 60;
}
