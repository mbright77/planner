using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Planner.Domain;
using Planner.Infrastructure.Identity;

namespace Planner.Infrastructure.Persistence;

public sealed class PlannerDbContext(DbContextOptions<PlannerDbContext> options)
    : IdentityDbContext<PlannerIdentityUser>(options)
{
    public DbSet<Family> Families => Set<Family>();

    public DbSet<FamilyMembership> FamilyMemberships => Set<FamilyMembership>();

    public DbSet<Profile> Profiles => Set<Profile>();

    public DbSet<ShoppingItem> ShoppingItems => Set<ShoppingItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasDefaultSchema("planner");

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PlannerDbContext).Assembly);
    }
}
