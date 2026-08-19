using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Planner.Domain;

namespace Planner.Infrastructure.Persistence.Configurations;

public sealed class UserCalendarPreferenceConfiguration : IEntityTypeConfiguration<UserCalendarPreference>
{
    public void Configure(EntityTypeBuilder<UserCalendarPreference> builder)
    {
        builder.ToTable("user_calendar_preferences");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.UserId)
            .HasMaxLength(450)
            .IsRequired();

        builder.Property(x => x.Sources)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.UpdatedAtUtc)
            .IsRequired();

        builder.HasIndex(x => x.UserId)
            .IsUnique();

        builder.HasOne(x => x.Family)
            .WithMany(x => x.UserCalendarPreferences)
            .HasForeignKey(x => x.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
