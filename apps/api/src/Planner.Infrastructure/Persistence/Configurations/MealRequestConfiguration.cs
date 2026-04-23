using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class MealRequestConfiguration : IEntityTypeConfiguration<MealRequest>
{
    public void Configure(EntityTypeBuilder<MealRequest> builder)
    {
        builder.ToTable("meal_requests");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Notes)
            .HasMaxLength(1000);

        builder.Property(x => x.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.HasIndex(x => new { x.FamilyId, x.Status, x.CreatedAtUtc });

        builder.HasOne(x => x.Family)
            .WithMany(x => x.MealRequests)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.RequesterProfile)
            .WithMany()
            .HasForeignKey(x => x.RequesterProfileId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.AssigneeProfile)
            .WithMany()
            .HasForeignKey(x => x.AssigneeProfileId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
