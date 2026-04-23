using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class FamilyInviteConfiguration : IEntityTypeConfiguration<FamilyInvite>
{
    public void Configure(EntityTypeBuilder<FamilyInvite> builder)
    {
        builder.ToTable("family_invites");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Email)
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(x => x.Token)
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(x => x.ExpiresAtUtc)
            .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.Property(x => x.AcceptedByUserId)
            .HasMaxLength(450);

        builder.HasIndex(x => x.Token)
            .IsUnique();

        builder.HasIndex(x => new { x.FamilyId, x.Email, x.AcceptedAtUtc });

        builder.HasOne(x => x.Family)
            .WithMany(x => x.Invites)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
