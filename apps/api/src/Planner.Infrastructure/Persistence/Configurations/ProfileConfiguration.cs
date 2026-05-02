using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class ProfileConfiguration : IEntityTypeConfiguration<Profile>
{
    public void Configure(EntityTypeBuilder<Profile> builder)
    {
        builder.ToTable("profiles");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.DisplayName)
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(x => x.ColorKey)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.PreferredLanguage)
            .HasMaxLength(10);

        builder.Property(x => x.LinkedUserId)
            .HasMaxLength(450);

        builder.Property(x => x.IsActive)
            .IsRequired();

        builder.HasIndex(x => new { x.FamilyId, x.IsActive });

        builder.HasIndex(x => x.LinkedUserId)
            .IsUnique()
            .HasFilter("\"LinkedUserId\" IS NOT NULL");

        builder.HasOne(x => x.Family)
            .WithMany(x => x.Profiles)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
