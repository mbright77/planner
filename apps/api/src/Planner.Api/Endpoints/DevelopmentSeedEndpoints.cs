using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Planner.Domain;
using Planner.Infrastructure.Identity;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class DevelopmentSeedEndpoints
{
    public static IEndpointRouteBuilder MapDevelopmentSeedEndpoints(this IEndpointRouteBuilder app)
    {
        var dev = app.MapGroup("/api/v1/dev");
        dev.MapPost("/seed", SeedAsync);

        return app;
    }

    private static async Task<IResult> SeedAsync(
        UserManager<PlannerIdentityUser> userManager,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        const string email = "admin@planner.local";
        const string password = "Planner123!";

        if (await userManager.FindByEmailAsync(email) is not null)
        {
            return Results.Ok(new { email, password, seeded = false });
        }

        var user = new PlannerIdentityUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
        };

        var createResult = await userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            return Results.BadRequest(new { errors = createResult.Errors.Select(x => x.Description).ToArray() });
        }

        var now = DateTimeOffset.UtcNow;
        var family = new Family
        {
            Id = Guid.NewGuid(),
            Name = "Planner Demo Family",
            Timezone = "UTC",
            CreatedAtUtc = now,
        };

        dbContext.Families.Add(family);
        dbContext.FamilyMemberships.Add(new FamilyMembership
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            UserId = user.Id,
            Role = FamilyRole.Admin,
            CreatedAtUtc = now,
        });
        dbContext.Profiles.AddRange(
            new Profile
            {
                Id = Guid.NewGuid(),
                FamilyId = family.Id,
                DisplayName = "Mom",
                ColorKey = "green",
                IsActive = true,
            },
            new Profile
            {
                Id = Guid.NewGuid(),
                FamilyId = family.Id,
                DisplayName = "Dad",
                ColorKey = "blue",
                IsActive = true,
            });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { email, password, seeded = true });
    }
}
