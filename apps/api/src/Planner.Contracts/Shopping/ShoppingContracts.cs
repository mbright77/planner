namespace Planner.Contracts.Shopping;

public sealed record ShoppingItemResponse(
    Guid Id,
    string Label,
    string Category,
    bool IsCompleted,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    Guid? AddedByProfileId);

public sealed record CreateShoppingItemRequest(string Label, string Category, Guid? AddedByProfileId);

public sealed record UpdateShoppingItemRequest(bool IsCompleted);
