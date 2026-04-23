using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Shopping;
using Planner.Domain;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class ShoppingEndpoints
{
    public static IEndpointRouteBuilder MapShoppingEndpoints(this IEndpointRouteBuilder app)
    {
        var shopping = app.MapGroup("/api/v1/shopping")
            .RequireAuthorization();

        shopping.MapGet(string.Empty, GetShoppingItemsAsync)
            .Produces<IReadOnlyList<ShoppingItemResponse>>(StatusCodes.Status200OK);
        shopping.MapPost(string.Empty, CreateShoppingItemAsync)
            .Produces<ShoppingItemResponse>(StatusCodes.Status201Created);
        shopping.MapPut("/{itemId:guid}", UpdateShoppingItemAsync)
            .Produces<ShoppingItemResponse>(StatusCodes.Status200OK);

        return app;
    }

    private static async Task<IResult> GetShoppingItemsAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var items = await dbContext.ShoppingItems
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId)
            .OrderBy(x => x.IsCompleted)
            .ThenBy(x => x.Category)
            .ThenBy(x => x.Label)
            .Select(x => new ShoppingItemResponse(
                x.Id,
                x.Label,
                x.Category,
                x.IsCompleted,
                x.CreatedAtUtc,
                x.CompletedAtUtc,
                x.AddedByProfileId))
            .ToListAsync(cancellationToken);

        return Results.Ok(items);
    }

    private static async Task<IResult> CreateShoppingItemAsync(
        HttpContext httpContext,
        CreateShoppingItemRequest request,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        if (request.AddedByProfileId.HasValue)
        {
            var profileExists = await dbContext.Profiles.AnyAsync(
                x => x.Id == request.AddedByProfileId.Value && x.FamilyId == membership.FamilyId,
                cancellationToken);

            if (!profileExists)
            {
                return Results.BadRequest(new { message = "The selected profile does not belong to this family." });
            }
        }

        var item = new ShoppingItem
        {
            Id = Guid.NewGuid(),
            FamilyId = membership.FamilyId,
            Label = request.Label.Trim(),
            Category = request.Category.Trim(),
            AddedByProfileId = request.AddedByProfileId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            IsCompleted = false,
        };

        dbContext.ShoppingItems.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/v1/shopping/{item.Id}", new ShoppingItemResponse(
            item.Id,
            item.Label,
            item.Category,
            item.IsCompleted,
            item.CreatedAtUtc,
            item.CompletedAtUtc,
            item.AddedByProfileId));
    }

    private static async Task<IResult> UpdateShoppingItemAsync(
        HttpContext httpContext,
        Guid itemId,
        UpdateShoppingItemRequest request,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var item = await dbContext.ShoppingItems
            .FirstOrDefaultAsync(x => x.Id == itemId && x.FamilyId == membership.FamilyId, cancellationToken);

        if (item is null)
        {
            return Results.NotFound();
        }

        item.IsCompleted = request.IsCompleted;
        item.CompletedAtUtc = request.IsCompleted ? DateTimeOffset.UtcNow : null;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new ShoppingItemResponse(
            item.Id,
            item.Label,
            item.Category,
            item.IsCompleted,
            item.CreatedAtUtc,
            item.CompletedAtUtc,
            item.AddedByProfileId));
    }

    private static Task<FamilyMembership?> GetMembershipAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.GetRequiredUserId();

        return dbContext.FamilyMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
    }
}
