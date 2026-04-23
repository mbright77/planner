using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class MealPlanConfiguration : IEntityTypeConfiguration<MealPlan>
{
    public void Configure(EntityTypeBuilder<MealPlan> builder)
    {
        builder.ToTable("meal_plans");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.MealDate)
            .IsRequired();

        builder.Property(x => x.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Notes)
            .HasMaxLength(1000);

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.HasIndex(x => new { x.FamilyId, x.MealDate })
            .IsUnique();

        builder.HasOne(x => x.Family)
            .WithMany(x => x.MealPlans)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.OwnerProfile)
            .WithMany(x => x.MealPlans)
            .HasForeignKey(x => x.OwnerProfileId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
