using Microsoft.Extensions.Logging;
using Planner.Domain;
using Planner.Infrastructure.Calendar;

namespace Planner.Infrastructure.Integrations.Google;

public sealed class GoogleCalendarEventReader(
    IGoogleCalendarClient calendarClient,
    IGoogleAccessTokenProvider accessTokenProvider,
    ILogger<GoogleCalendarEventReader> logger) : IGoogleCalendarEventReader
{
    private const int MaxConcurrentCalendars = 4;

    // Shared across every calendar in the fan-out: a slow calendar can't stall the whole read
    // past this, even though each is also bounded by the HttpClient's own per-call timeout.
    private static readonly TimeSpan SharedDeadline = TimeSpan.FromSeconds(10);

    public async Task<GoogleCalendarReadResult> ReadEventsAsync(
        GoogleCalendarConnection connection,
        DateTimeOffset rangeStartUtc,
        DateTimeOffset rangeEndUtc,
        TimeZoneInfo familyTimeZone,
        CancellationToken cancellationToken)
    {
        var selected = connection.Subscriptions.Where(x => x.IsSelected).ToList();
        if (selected.Count == 0)
        {
            return new GoogleCalendarReadResult([], GoogleSourceStatus.Ok, []);
        }

        var accessToken = await accessTokenProvider.GetAccessTokenAsync(connection, cancellationToken);
        if (accessToken is null)
        {
            return new GoogleCalendarReadResult([], GoogleSourceStatus.NeedsReauth, []);
        }

        using var semaphore = new SemaphoreSlim(MaxConcurrentCalendars);
        using var deadlineCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadlineCts.CancelAfter(SharedDeadline);

        var fetchTasks = selected.Select(subscription => FetchCalendarAsync(
            accessToken, subscription, rangeStartUtc, rangeEndUtc, familyTimeZone, semaphore, deadlineCts.Token, cancellationToken));

        var results = await Task.WhenAll(fetchTasks);

        var events = results.Where(x => x.Succeeded).SelectMany(x => x.Events!).ToList();
        var failedNames = results.Where(x => !x.Succeeded).Select(x => x.Subscription.Summary).ToList();

        var status = failedNames.Count switch
        {
            0 => GoogleSourceStatus.Ok,
            _ when failedNames.Count == selected.Count => GoogleSourceStatus.Error,
            _ => GoogleSourceStatus.Partial,
        };

        return new GoogleCalendarReadResult(events, status, failedNames);
    }

    private async Task<CalendarFetchResult> FetchCalendarAsync(
        string accessToken,
        GoogleCalendarSubscription subscription,
        DateTimeOffset rangeStartUtc,
        DateTimeOffset rangeEndUtc,
        TimeZoneInfo familyTimeZone,
        SemaphoreSlim semaphore,
        CancellationToken deadlineToken,
        CancellationToken callerToken)
    {
        await semaphore.WaitAsync(callerToken);
        try
        {
            var rawEntries = await calendarClient.ListEventsAsync(
                accessToken, subscription.GoogleCalendarId, rangeStartUtc, rangeEndUtc, familyTimeZone.Id, deadlineToken);

            var mapped = rawEntries
                .Select(entry => GoogleCalendarEventMapper.Map(entry, subscription, familyTimeZone))
                .Where(x => x is not null)
                .Select(x => x!)
                .ToList();

            return CalendarFetchResult.Success(subscription, mapped);
        }
        catch (OperationCanceledException) when (!callerToken.IsCancellationRequested)
        {
            // The shared deadline tripped, not the caller - contain it to this one calendar
            // rather than failing the whole read.
            logger.LogWarning("Timed out reading events for Google calendar {CalendarId}.", subscription.GoogleCalendarId);
            return CalendarFetchResult.Failure(subscription);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Failed to read events for Google calendar {CalendarId}.", subscription.GoogleCalendarId);
            return CalendarFetchResult.Failure(subscription);
        }
        finally
        {
            semaphore.Release();
        }
    }

    private sealed record CalendarFetchResult(GoogleCalendarSubscription Subscription, bool Succeeded, IReadOnlyList<AggregatedEvent>? Events)
    {
        public static CalendarFetchResult Success(GoogleCalendarSubscription subscription, IReadOnlyList<AggregatedEvent> events) =>
            new(subscription, true, events);

        public static CalendarFetchResult Failure(GoogleCalendarSubscription subscription) =>
            new(subscription, false, null);
    }
}
