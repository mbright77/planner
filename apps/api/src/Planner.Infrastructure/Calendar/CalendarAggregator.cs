using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Planner.Contracts.Dashboard;
using Planner.Domain;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Persistence;

namespace Planner.Infrastructure.Calendar;

/// <summary>
/// Cached wrapper for Google events to store in IMemoryCache
/// </summary>
internal sealed record CachedGoogleEvents(
    IReadOnlyList<AggregatedEvent> Events,
    GoogleSourceStatus Status,
    IReadOnlyList<string> FailedCalendarNames);

public sealed class CalendarAggregator(
    IGoogleCalendarEventReader googleEventReader,
    IMemoryCache memoryCache,
    PlannerDbContext dbContext) : ICalendarAggregator
{
    private const int CacheDurationSeconds = 60;

    public async Task<AggregationResult> AggregateAsync(
        Guid familyId,
        DateTimeOffset weekStartUtc,
        DateTimeOffset weekEndExclusiveUtc,
        DateTimeOffset dayStartUtc,
        DateTimeOffset dayEndExclusiveUtc,
        TimeZoneInfo familyTimeZone,
        GoogleCalendarConnection? googleConnection,
        CalendarSourceSelection effectiveSources,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var needsGoogle = effectiveSources is CalendarSourceSelection.Google or CalendarSourceSelection.Both;

        // Fetch local events
        var localWeekEvents = await FetchLocalWeekEventsAsync(familyId, weekStartUtc, weekEndExclusiveUtc, cancellationToken);

        GoogleSourceStatus googleStatus = GoogleSourceStatus.Ok;
        IReadOnlyList<string> failedCalendarNames = [];
        IReadOnlyList<AggregatedEvent> googleWeekEvents = [];

        // Fetch Google events if needed and connection exists
        if (needsGoogle && googleConnection is not null)
        {
            var cacheKey = BuildCacheKey(googleConnection.Id, weekStartUtc, googleConnection.Subscriptions);
            
            // Try to get from cache
            if (memoryCache.TryGetValue<CachedGoogleEvents>(cacheKey, out var cached) && cached is not null)
            {
                googleWeekEvents = cached.Events;
                googleStatus = cached.Status;
                failedCalendarNames = cached.FailedCalendarNames;
            }
            else
            {
                var readResult = await googleEventReader.ReadEventsAsync(
                    googleConnection,
                    weekStartUtc,
                    weekEndExclusiveUtc,
                    familyTimeZone,
                    cancellationToken);

                googleWeekEvents = readResult.Events;
                googleStatus = readResult.Status;
                failedCalendarNames = readResult.FailedCalendarNames;

                // Cache the results
                var ttl = googleStatus == GoogleSourceStatus.Ok 
                    ? TimeSpan.FromSeconds(CacheDurationSeconds)
                    : TimeSpan.FromSeconds(5); // Shorter TTL for error states
                
                memoryCache.Set(cacheKey, new CachedGoogleEvents(googleWeekEvents, googleStatus, failedCalendarNames), ttl);
            }
        }

        // Merge events for the week
        var mergedWeekEvents = MergeAndSortEvents(localWeekEvents, googleWeekEvents);

        // Filter to today's events
        var mergedTodayEvents = mergedWeekEvents
            .Where(x => x.StartAtUtc >= dayStartUtc && x.StartAtUtc < dayEndExclusiveUtc)
            .ToList();

        // Find next upcoming event
        var nextUpcoming = mergedWeekEvents
            .Where(x => x.StartAtUtc >= now)
            .OrderBy(x => x.StartAtUtc)
            .ThenBy(x => x.Title)
            .FirstOrDefault();

        // Map to DashboardEventSummary for today events
        var todaySummaries = mergedTodayEvents
            .Select(x => MapToDashboardEventSummary(x, now))
            .ToList();

        return new AggregationResult(
            todaySummaries,
            mergedWeekEvents,
            nextUpcoming,
            googleStatus,
            failedCalendarNames);
    }

    private async Task<IReadOnlyList<AggregatedEvent>> FetchLocalWeekEventsAsync(
        Guid familyId,
        DateTimeOffset weekStartUtc,
        DateTimeOffset weekEndExclusiveUtc,
        CancellationToken cancellationToken)
    {
        // Fetch all events for the family first (matching original DashboardEndpoints pattern)
        var localEvents = await dbContext.CalendarEvents
            .AsNoTracking()
            .Where(x => x.FamilyId == familyId)
            .ToListAsync(cancellationToken);

        // Filter and map to AggregatedEvent in memory
        return localEvents
            .Where(x => x.StartAtUtc >= weekStartUtc && x.StartAtUtc < weekEndExclusiveUtc)
            .OrderBy(x => x.StartAtUtc)
            .ThenBy(x => x.Title)
            .Select(x => new AggregatedEvent(
                x.Id.ToString(),
                x.Title,
                x.Notes,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AssignedProfileId,
                Source: "Local",
                SourceLabel: null,
                SourceColorHex: null,
                IsAllDay: false,
                IsReadOnly: false))
            .ToList();
    }

    private static IReadOnlyList<AggregatedEvent> MergeAndSortEvents(
        IReadOnlyList<AggregatedEvent> localEvents,
        IReadOnlyList<AggregatedEvent> googleEvents)
    {
        // Union without de-duplication - same event on multiple calendars should show multiple times
        var merged = new List<AggregatedEvent>(localEvents.Count + googleEvents.Count);
        merged.AddRange(localEvents);
        merged.AddRange(googleEvents);
        
        // Sort by StartAtUtc, then by title for stable ordering
        merged.Sort((a, b) => 
        {
            var startCompare = a.StartAtUtc.CompareTo(b.StartAtUtc);
            return startCompare != 0 ? startCompare : string.Compare(a.Title, b.Title, StringComparison.Ordinal);
        });
        
        return merged;
    }

    private static DashboardEventSummary MapToDashboardEventSummary(AggregatedEvent ev, DateTimeOffset now)
    {
        return new DashboardEventSummary(
            // Use string ID to accommodate both Guid (Local) and string (Google)
            ev.Id,
            ev.Title,
            ev.Notes,
            ev.StartAtUtc,
            ev.EndAtUtc,
            ev.AssignedProfileId,
            ev.EndAtUtc < now,
            ev.Source,
            ev.SourceLabel,
            ev.SourceColorHex,
            ev.IsAllDay,
            ev.IsReadOnly);
    }

    private static string BuildCacheKey(Guid connectionId, DateTimeOffset weekStartUtc, ICollection<GoogleCalendarSubscription> subscriptions)
    {
        // Create a hash of the selected calendar IDs for cache invalidation
        var selectedIds = subscriptions
            .Where(s => s.IsSelected)
            .OrderBy(s => s.GoogleCalendarId)
            .Select(s => s.GoogleCalendarId)
            .ToList();
        
        var selectedHash = string.Join("|", selectedIds);
        return $"google-events:{connectionId}:{weekStartUtc:yyyyMMdd}:{selectedHash}";
    }
}
