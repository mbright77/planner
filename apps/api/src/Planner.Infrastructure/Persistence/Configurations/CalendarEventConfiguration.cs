using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class CalendarEventConfiguration : IEntityTypeConfiguration<CalendarEvent>
{
    public void Configure(EntityTypeBuilder<CalendarEvent> builder)
    {
        builder.ToTable("calendar_events");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Notes)
            .HasMaxLength(1000);

        builder.Property(x => x.StartAtUtc)
            .IsRequired();

        builder.Property(x => x.EndAtUtc)
            .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.HasIndex(x => new { x.FamilyId, x.StartAtUtc });

        builder.HasOne(x => x.Family)
            .WithMany(x => x.CalendarEvents)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.AssignedProfile)
            .WithMany(x => x.CalendarEvents)
            .HasForeignKey(x => x.AssignedProfileId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
