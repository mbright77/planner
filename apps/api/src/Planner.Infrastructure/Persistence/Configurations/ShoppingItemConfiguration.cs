using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class ShoppingItemConfiguration : IEntityTypeConfiguration<ShoppingItem>
{
    public void Configure(EntityTypeBuilder<ShoppingItem> builder)
    {
        builder.ToTable("shopping_items");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Label)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Category)
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.Property(x => x.IsCompleted)
            .IsRequired();

        builder.HasIndex(x => new { x.FamilyId, x.IsCompleted, x.Category, x.Label });

        builder.HasOne(x => x.Family)
            .WithMany(x => x.ShoppingItems)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.AddedByProfile)
            .WithMany()
            .HasForeignKey(x => x.AddedByProfileId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
