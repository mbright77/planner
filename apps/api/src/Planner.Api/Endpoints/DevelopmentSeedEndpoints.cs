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
        var momProfileId = Guid.NewGuid();
        var dadProfileId = Guid.NewGuid();

        dbContext.Profiles.AddRange(
            new Profile
            {
                Id = momProfileId,
                FamilyId = family.Id,
                DisplayName = "Mom",
                ColorKey = "green",
                IsActive = true,
            },
            new Profile
            {
                Id = dadProfileId,
                FamilyId = family.Id,
                DisplayName = "Dad",
                ColorKey = "blue",
                IsActive = true,
            });

        dbContext.ShoppingItems.AddRange(
            new ShoppingItem
            {
                Id = Guid.NewGuid(),
                FamilyId = family.Id,
                Label = "Milk",
                Category = "Dairy",
                CreatedAtUtc = now,
                IsCompleted = false,
                AddedByProfileId = momProfileId,
            },
            new ShoppingItem
            {
                Id = Guid.NewGuid(),
                FamilyId = family.Id,
                Label = "Bananas",
                Category = "Produce",
                CreatedAtUtc = now,
                IsCompleted = false,
                AddedByProfileId = dadProfileId,
            },
            new ShoppingItem
            {
                Id = Guid.NewGuid(),
                FamilyId = family.Id,
                Label = "Paper Towels",
                Category = "Household",
                CreatedAtUtc = now,
                IsCompleted = true,
                CompletedAtUtc = now,
            });

        dbContext.CalendarEvents.AddRange(
            new CalendarEvent
            {
                Id = Guid.NewGuid(),
                FamilyId = family.Id,
                Title = "School drop-off",
                Notes = "Bring lunchbox",
                StartAtUtc = now.Date.AddHours(8),
                EndAtUtc = now.Date.AddHours(8).AddMinutes(30),
                CreatedAtUtc = now,
                AssignedProfileId = dadProfileId,
            },
            new CalendarEvent
            {
                Id = Guid.NewGuid(),
                FamilyId = family.Id,
                Title = "Soccer practice",
                Notes = "Cleats and water bottle",
                StartAtUtc = now.Date.AddHours(16),
                EndAtUtc = now.Date.AddHours(17).AddMinutes(30),
                CreatedAtUtc = now,
                AssignedProfileId = momProfileId,
            });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { email, password, seeded = true });
    }
}
