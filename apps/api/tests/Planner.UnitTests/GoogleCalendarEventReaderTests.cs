using Microsoft.Extensions.Logging.Abstractions;
using Planner.Domain;
using Planner.Infrastructure.Calendar;
using Planner.Infrastructure.Integrations.Google;

namespace Planner.UnitTests;

public class GoogleCalendarEventReaderTests
{
    private static readonly TimeZoneInfo UtcTimeZone = TimeZoneInfo.Utc;
    private static readonly DateTimeOffset RangeStart = new(2026, 3, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset RangeEnd = new(2026, 3, 8, 0, 0, 0, TimeSpan.Zero);

    private static GoogleCalendarConnection CreateConnection(params GoogleCalendarSubscription[] subscriptions)
    {
        var connection = new GoogleCalendarConnection { Id = Guid.NewGuid(), Status = GoogleConnectionStatus.Connected };
        foreach (var subscription in subscriptions)
        {
            connection.Subscriptions.Add(subscription);
        }

        return connection;
    }

    private static GoogleCalendarSubscription CreateSubscription(string googleCalendarId, string summary, bool isSelected = true) => new()
    {
        Id = Guid.NewGuid(),
        GoogleCalendarId = googleCalendarId,
        Summary = summary,
        IsSelected = isSelected,
        AccessRole = "owner",
    };

    private static GoogleCalendarEventEntry CreateEntry(string id) =>
        new(id, "confirmed", "Event " + id, null, false, null, null, RangeStart.AddHours(1), RangeStart.AddHours(2), false);

    [Fact]
    public async Task ReadEventsAsync_with_no_selected_calendars_returns_ok_and_no_events()
    {
        var connection = CreateConnection(CreateSubscription("cal-1", "Cal 1", isSelected: false));
        var calendarClient = new FakeGoogleCalendarClient();
        var tokenProvider = new FakeAccessTokenProvider { Token = "access-token" };
        var reader = new GoogleCalendarEventReader(calendarClient, tokenProvider, NullLogger<GoogleCalendarEventReader>.Instance);

        var result = await reader.ReadEventsAsync(connection, RangeStart, RangeEnd, UtcTimeZone, CancellationToken.None);

        Assert.Equal(GoogleSourceStatus.Ok, result.Status);
        Assert.Empty(result.Events);
        Assert.Empty(calendarClient.RequestedCalendarIds);
    }

    [Fact]
    public async Task ReadEventsAsync_returns_needs_reauth_and_no_events_when_the_token_provider_fails()
    {
        var connection = CreateConnection(CreateSubscription("cal-1", "Cal 1"));
        var calendarClient = new FakeGoogleCalendarClient();
        var tokenProvider = new FakeAccessTokenProvider { Token = null };
        var reader = new GoogleCalendarEventReader(calendarClient, tokenProvider, NullLogger<GoogleCalendarEventReader>.Instance);

        var result = await reader.ReadEventsAsync(connection, RangeStart, RangeEnd, UtcTimeZone, CancellationToken.None);

        Assert.Equal(GoogleSourceStatus.NeedsReauth, result.Status);
        Assert.Empty(result.Events);
        Assert.Empty(calendarClient.RequestedCalendarIds);
    }

    [Fact]
    public async Task ReadEventsAsync_merges_events_from_every_selected_calendar_and_ignores_unselected_ones()
    {
        var selected1 = CreateSubscription("cal-1", "Cal 1");
        var selected2 = CreateSubscription("cal-2", "Cal 2");
        var unselected = CreateSubscription("cal-3", "Cal 3", isSelected: false);
        var connection = CreateConnection(selected1, selected2, unselected);

        var calendarClient = new FakeGoogleCalendarClient();
        calendarClient.EventsByCalendarId["cal-1"] = [CreateEntry("event-1")];
        calendarClient.EventsByCalendarId["cal-2"] = [CreateEntry("event-2")];
        calendarClient.EventsByCalendarId["cal-3"] = [CreateEntry("event-3")];

        var tokenProvider = new FakeAccessTokenProvider { Token = "access-token" };
        var reader = new GoogleCalendarEventReader(calendarClient, tokenProvider, NullLogger<GoogleCalendarEventReader>.Instance);

        var result = await reader.ReadEventsAsync(connection, RangeStart, RangeEnd, UtcTimeZone, CancellationToken.None);

        Assert.Equal(GoogleSourceStatus.Ok, result.Status);
        Assert.Equal(2, result.Events.Count);
        Assert.Contains(result.Events, x => x.Id == "event-1");
        Assert.Contains(result.Events, x => x.Id == "event-2");
        Assert.DoesNotContain(result.Events, x => x.Id == "event-3");
        Assert.Equal(["cal-1", "cal-2"], calendarClient.RequestedCalendarIds.OrderBy(x => x));
    }

    [Fact]
    public async Task ReadEventsAsync_one_failing_calendar_yields_partial_with_the_healthy_events_present()
    {
        var healthy = CreateSubscription("cal-healthy", "Healthy");
        var broken = CreateSubscription("cal-broken", "Broken");
        var connection = CreateConnection(healthy, broken);

        var calendarClient = new FakeGoogleCalendarClient();
        calendarClient.EventsByCalendarId["cal-healthy"] = [CreateEntry("event-ok")];
        calendarClient.ExceptionsByCalendarId["cal-broken"] = new HttpRequestException("boom");

        var tokenProvider = new FakeAccessTokenProvider { Token = "access-token" };
        var reader = new GoogleCalendarEventReader(calendarClient, tokenProvider, NullLogger<GoogleCalendarEventReader>.Instance);

        var result = await reader.ReadEventsAsync(connection, RangeStart, RangeEnd, UtcTimeZone, CancellationToken.None);

        Assert.Equal(GoogleSourceStatus.Partial, result.Status);
        Assert.Single(result.Events);
        Assert.Equal("event-ok", result.Events[0].Id);
        Assert.Equal(["Broken"], result.FailedCalendarNames);
    }

    [Fact]
    public async Task ReadEventsAsync_every_calendar_failing_yields_error_and_no_events()
    {
        var subscription = CreateSubscription("cal-1", "Cal 1");
        var connection = CreateConnection(subscription);

        var calendarClient = new FakeGoogleCalendarClient();
        calendarClient.ExceptionsByCalendarId["cal-1"] = new HttpRequestException("boom");

        var tokenProvider = new FakeAccessTokenProvider { Token = "access-token" };
        var reader = new GoogleCalendarEventReader(calendarClient, tokenProvider, NullLogger<GoogleCalendarEventReader>.Instance);

        var result = await reader.ReadEventsAsync(connection, RangeStart, RangeEnd, UtcTimeZone, CancellationToken.None);

        Assert.Equal(GoogleSourceStatus.Error, result.Status);
        Assert.Empty(result.Events);
        Assert.Equal(["Cal 1"], result.FailedCalendarNames);
    }

    [Fact]
    public async Task ReadEventsAsync_propagates_caller_cancellation_instead_of_treating_it_as_a_calendar_failure()
    {
        var subscription = CreateSubscription("cal-1", "Cal 1");
        var connection = CreateConnection(subscription);

        var calendarClient = new FakeGoogleCalendarClient();
        calendarClient.ExceptionsByCalendarId["cal-1"] = new OperationCanceledException();

        var tokenProvider = new FakeAccessTokenProvider { Token = "access-token" };
        var reader = new GoogleCalendarEventReader(calendarClient, tokenProvider, NullLogger<GoogleCalendarEventReader>.Instance);

        using var cts = new CancellationTokenSource();
        cts.Cancel();

        // WaitAsync on an already-cancelled token surfaces as TaskCanceledException (a subclass
        // of OperationCanceledException) rather than the fake client's own exception - either way
        // it must propagate, not be swallowed as a per-calendar failure.
        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => reader.ReadEventsAsync(connection, RangeStart, RangeEnd, UtcTimeZone, cts.Token));
    }

    private sealed class FakeAccessTokenProvider : IGoogleAccessTokenProvider
    {
        public string? Token { get; set; }

        public Task<string?> GetAccessTokenAsync(GoogleCalendarConnection connection, CancellationToken cancellationToken) =>
            Task.FromResult(Token);
    }

    private sealed class FakeGoogleCalendarClient : IGoogleCalendarClient
    {
        public Dictionary<string, List<GoogleCalendarEventEntry>> EventsByCalendarId { get; } = [];

        public Dictionary<string, Exception> ExceptionsByCalendarId { get; } = [];

        public List<string> RequestedCalendarIds { get; } = [];

        public Task<IReadOnlyList<GoogleCalendarListEntry>> ListCalendarsAsync(string accessToken, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<GoogleCalendarEventEntry>> ListEventsAsync(
            string accessToken,
            string calendarId,
            DateTimeOffset timeMinUtc,
            DateTimeOffset timeMaxUtc,
            string timeZoneId,
            CancellationToken cancellationToken)
        {
            lock (RequestedCalendarIds)
            {
                RequestedCalendarIds.Add(calendarId);
            }

            if (ExceptionsByCalendarId.TryGetValue(calendarId, out var exception))
            {
                throw exception;
            }

            var events = EventsByCalendarId.TryGetValue(calendarId, out var found)
                ? (IReadOnlyList<GoogleCalendarEventEntry>)found
                : [];
            return Task.FromResult(events);
        }
    }
}
