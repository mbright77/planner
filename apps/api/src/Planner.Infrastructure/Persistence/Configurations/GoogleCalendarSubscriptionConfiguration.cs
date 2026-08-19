using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class GoogleCalendarSubscriptionConfiguration : IEntityTypeConfiguration<GoogleCalendarSubscription>
{
    public void Configure(EntityTypeBuilder<GoogleCalendarSubscription> builder)
    {
        builder.ToTable("google_calendar_subscriptions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.GoogleCalendarId)
            .HasMaxLength(512)
            .IsRequired();

        builder.Property(x => x.Summary)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(2000);

        builder.Property(x => x.ColorHex)
            .HasMaxLength(20);

        builder.Property(x => x.TimeZone)
            .HasMaxLength(100);

        builder.Property(x => x.AccessRole)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.LastSeenAtUtc)
            .IsRequired();

        builder.HasIndex(x => new { x.ConnectionId, x.GoogleCalendarId })
            .IsUnique();

        builder.HasOne(x => x.Connection)
            .WithMany(x => x.Subscriptions)
            .HasForeignKey(x => x.ConnectionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
