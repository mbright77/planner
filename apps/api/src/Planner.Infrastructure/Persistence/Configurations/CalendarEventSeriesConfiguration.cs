using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class CalendarEventSeriesConfiguration : IEntityTypeConfiguration<CalendarEventSeries>
{
    public void Configure(EntityTypeBuilder<CalendarEventSeries> builder)
    {
        builder.ToTable("calendar_event_series");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Notes)
            .HasMaxLength(1000);

        builder.Property(x => x.StartsAtUtc)
            .IsRequired();

        builder.Property(x => x.EndsAtUtc)
            .IsRequired();

        builder.Property(x => x.RepeatUntil)
            .IsRequired();

        builder.Property(x => x.MaterializedThrough)
            .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.HasIndex(x => new { x.FamilyId, x.RepeatUntil });

        builder.HasOne(x => x.Family)
            .WithMany(x => x.CalendarEventSeries)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.AssignedProfile)
            .WithMany()
            .HasForeignKey(x => x.AssignedProfileId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
