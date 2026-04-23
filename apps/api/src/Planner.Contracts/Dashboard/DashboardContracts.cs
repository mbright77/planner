namespace Planner.Contracts.Dashboard;

public sealed record DashboardOverviewResponse(
    DateOnly Date,
    DateOnly WeekStart,
    DateOnly WeekEnd,
    IReadOnlyList<DashboardDaySummary> Week,
    IReadOnlyList<DashboardEventSummary> TodayEvents,
    DashboardMealSummary? TonightMeal,
    DashboardShoppingSummary Shopping,
    DashboardUpcomingEventSummary? UpcomingEvent);

public sealed record DashboardDaySummary(
    DateOnly Date,
    int EventCount,
    bool HasMeal);

public sealed record DashboardEventSummary(
    Guid Id,
    string Title,
    string? Notes,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    Guid? AssignedProfileId,
    bool IsPast);

public sealed record DashboardMealSummary(
    Guid Id,
    string Title,
    string? Notes,
    Guid? OwnerProfileId);

public sealed record DashboardShoppingSummary(
    int OpenItemsCount,
    IReadOnlyList<string> PreviewLabels);

public sealed record DashboardUpcomingEventSummary(
    Guid Id,
    string Title,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    Guid? AssignedProfileId);
