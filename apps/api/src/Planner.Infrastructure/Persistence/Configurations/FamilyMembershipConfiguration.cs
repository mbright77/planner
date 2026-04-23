using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class FamilyMembershipConfiguration : IEntityTypeConfiguration<FamilyMembership>
{
    public void Configure(EntityTypeBuilder<FamilyMembership> builder)
    {
        builder.ToTable("family_memberships");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.UserId)
            .HasMaxLength(450)
            .IsRequired();

        builder.Property(x => x.Role)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.HasIndex(x => new { x.FamilyId, x.UserId })
            .IsUnique();

        builder.HasOne(x => x.Family)
            .WithMany(x => x.Memberships)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
