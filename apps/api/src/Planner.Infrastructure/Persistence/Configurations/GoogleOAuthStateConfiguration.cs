using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class GoogleOAuthStateConfiguration : IEntityTypeConfiguration<GoogleOAuthState>
{
    public void Configure(EntityTypeBuilder<GoogleOAuthState> builder)
    {
        builder.ToTable("google_oauth_states");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.UserId)
            .HasMaxLength(450)
            .IsRequired();

        builder.Property(x => x.StateHash)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(x => x.CodeVerifier)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.Property(x => x.ExpiresAtUtc)
            .IsRequired();

        builder.HasIndex(x => x.StateHash)
            .IsUnique();
    }
}
