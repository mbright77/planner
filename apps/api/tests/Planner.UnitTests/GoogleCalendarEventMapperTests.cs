using Planner.Domain;
using Planner.Infrastructure.Integrations.Google;

namespace Planner.UnitTests;

public class GoogleCalendarEventMapperTests
{
    private static readonly TimeZoneInfo StockholmTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm");

    private static GoogleCalendarSubscription CreateSubscription() => new()
    {
        Id = Guid.NewGuid(),
        ConnectionId = Guid.NewGuid(),
        GoogleCalendarId = "primary@group.calendar.google.com",
        Summary = "Family",
        ColorHex = "#ff0000",
        AccessRole = "owner",
        IsPrimary = true,
    };

    [Fact]
    public void Map_a_timed_event_passes_through_googles_own_offset()
    {
        var subscription = CreateSubscription();
        var start = new DateTimeOffset(2026, 3, 10, 9, 0, 0, TimeSpan.FromHours(1));
        var end = new DateTimeOffset(2026, 3, 10, 10, 0, 0, TimeSpan.FromHours(1));
        var entry = new GoogleCalendarEventEntry(
            "event-1", "confirmed", "Dentist", "Bring insurance card", false, null, null, start, end, false);

        var mapped = GoogleCalendarEventMapper.Map(entry, subscription, StockholmTimeZone);

        Assert.NotNull(mapped);
        Assert.Equal("event-1", mapped.Id);
        Assert.Equal("Dentist", mapped.Title);
        Assert.Equal("Bring insurance card", mapped.Notes);
        Assert.Equal(start, mapped.StartAtUtc);
        Assert.Equal(end, mapped.EndAtUtc);
        Assert.False(mapped.IsAllDay);
        Assert.Null(mapped.AssignedProfileId);
        Assert.Equal("Google", mapped.Source);
        Assert.Equal("Family", mapped.SourceLabel);
        Assert.Equal("#ff0000", mapped.SourceColorHex);
        Assert.True(mapped.IsReadOnly);
    }

    [Fact]
    public void Map_an_all_day_event_converts_family_local_midnight_to_utc()
    {
        var subscription = CreateSubscription();
        var entry = new GoogleCalendarEventEntry(
            "event-2", "confirmed", "Family Trip", null, true,
            new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 3), null, null, false);

        var mapped = GoogleCalendarEventMapper.Map(entry, subscription, StockholmTimeZone);

        Assert.NotNull(mapped);
        Assert.True(mapped.IsAllDay);
        // Stockholm is UTC+2 in June (DST) - local midnight June 1st is 22:00 UTC May 31st.
        Assert.Equal(new DateTimeOffset(2026, 5, 31, 22, 0, 0, TimeSpan.Zero), mapped.StartAtUtc);
        // end.date is already exclusive, so June 3rd maps straight through with no -1 day fudge.
        Assert.Equal(new DateTimeOffset(2026, 6, 2, 22, 0, 0, TimeSpan.Zero), mapped.EndAtUtc);
    }

    [Fact]
    public void Map_a_timed_event_crossing_midnight_preserves_the_correct_utc_instants()
    {
        var subscription = CreateSubscription();
        // 23:00-01:00 family-local, i.e. an event that crosses midnight.
        var start = new DateTimeOffset(2026, 3, 10, 23, 0, 0, TimeSpan.FromHours(1));
        var end = new DateTimeOffset(2026, 3, 11, 1, 0, 0, TimeSpan.FromHours(1));
        var entry = new GoogleCalendarEventEntry(
            "event-3", "confirmed", "Late Flight", null, false, null, null, start, end, false);

        var mapped = GoogleCalendarEventMapper.Map(entry, subscription, StockholmTimeZone);

        Assert.NotNull(mapped);
        Assert.Equal(start.ToUniversalTime(), mapped.StartAtUtc);
        Assert.Equal(end.ToUniversalTime(), mapped.EndAtUtc);
        Assert.True(mapped.EndAtUtc > mapped.StartAtUtc);
    }

    [Fact]
    public void Map_a_recurring_instance_maps_like_any_other_timed_event()
    {
        // With singleEvents=true, Google expands recurrence into normal event objects - the
        // mapper needs no special-casing, it just uses whatever id and time Google assigned to
        // this particular instance.
        var subscription = CreateSubscription();
        var start = new DateTimeOffset(2026, 4, 6, 8, 0, 0, TimeSpan.FromHours(2));
        var end = new DateTimeOffset(2026, 4, 6, 8, 30, 0, TimeSpan.FromHours(2));
        var entry = new GoogleCalendarEventEntry(
            "series-abc123_20260406T060000Z", "confirmed", "Standup", null, false, null, null, start, end, false);

        var mapped = GoogleCalendarEventMapper.Map(entry, subscription, StockholmTimeZone);

        Assert.NotNull(mapped);
        Assert.Equal("series-abc123_20260406T060000Z", mapped.Id);
        Assert.Equal(start, mapped.StartAtUtc);
        Assert.Equal(end, mapped.EndAtUtc);
    }

    [Fact]
    public void Map_a_cancelled_event_is_filtered_out()
    {
        var subscription = CreateSubscription();
        var start = new DateTimeOffset(2026, 3, 10, 9, 0, 0, TimeSpan.FromHours(1));
        var end = new DateTimeOffset(2026, 3, 10, 10, 0, 0, TimeSpan.FromHours(1));
        var entry = new GoogleCalendarEventEntry(
            "event-4", "cancelled", "Cancelled Meeting", null, false, null, null, start, end, false);

        var mapped = GoogleCalendarEventMapper.Map(entry, subscription, StockholmTimeZone);

        Assert.Null(mapped);
    }

    [Fact]
    public void Map_an_event_declined_by_the_connected_user_is_filtered_out()
    {
        var subscription = CreateSubscription();
        var start = new DateTimeOffset(2026, 3, 10, 9, 0, 0, TimeSpan.FromHours(1));
        var end = new DateTimeOffset(2026, 3, 10, 10, 0, 0, TimeSpan.FromHours(1));
        var entry = new GoogleCalendarEventEntry(
            "event-5", "confirmed", "Optional Sync", null, false, null, null, start, end, true);

        var mapped = GoogleCalendarEventMapper.Map(entry, subscription, StockholmTimeZone);

        Assert.Null(mapped);
    }
}
