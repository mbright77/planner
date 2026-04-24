namespace Planner.Contracts.Meals;

public sealed record MealPlanResponse(
    Guid Id,
    DateOnly MealDate,
    string Title,
    string? Notes,
    Guid? OwnerProfileId);

public sealed record WeeklyMealsResponse(
    DateOnly WeekStart,
    DateOnly WeekEnd,
    IReadOnlyList<MealPlanResponse> Meals);

public sealed record CreateMealPlanRequest(
    DateOnly MealDate,
    string Title,
    string? Notes,
    Guid? OwnerProfileId);

public sealed record UpdateMealPlanRequest(
    DateOnly MealDate,
    string Title,
    string? Notes,
    Guid? OwnerProfileId);

public sealed record MealRequestResponse(
    Guid Id,
    Guid? RequesterProfileId,
    DateOnly? RequestedForDate,
    string Title,
    string? Notes,
    string Status,
    Guid? AssigneeProfileId,
    DateTimeOffset CreatedAtUtc);

public sealed record CreateMealRequestRequest(
    DateOnly? RequestedForDate,
    string Title,
    string? Notes);

public sealed record AssignMealRequestRequest(Guid? AssigneeProfileId);
