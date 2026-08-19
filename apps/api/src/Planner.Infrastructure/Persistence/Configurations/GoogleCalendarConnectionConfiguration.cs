using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class GoogleCalendarConnectionConfiguration : IEntityTypeConfiguration<GoogleCalendarConnection>
{
    public void Configure(EntityTypeBuilder<GoogleCalendarConnection> builder)
    {
        builder.ToTable("google_calendar_connections");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.UserId)
            .HasMaxLength(450)
            .IsRequired();

        builder.Property(x => x.GoogleAccountEmail)
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(x => x.GoogleAccountSubject)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.RefreshTokenCipher)
            .IsRequired();

        builder.Property(x => x.RefreshTokenNonce)
            .IsRequired();

        builder.Property(x => x.RefreshTokenTag)
            .IsRequired();

        builder.Property(x => x.KeyVersion)
            .IsRequired();

        builder.Property(x => x.GrantedScopes)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.Status)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(x => x.ConnectedAtUtc)
            .IsRequired();

        builder.Property(x => x.LastError)
            .HasMaxLength(2000);

        builder.HasIndex(x => x.UserId)
            .IsUnique();

        builder.HasOne(x => x.Family)
            .WithMany(x => x.GoogleCalendarConnections)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
