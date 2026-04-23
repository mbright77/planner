using Microsoft.EntityFrameworkCore;
using Planner.Api.Extensions;
using Planner.Contracts.Meals;
using Planner.Domain;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class MealEndpoints
{
    public static IEndpointRouteBuilder MapMealEndpoints(this IEndpointRouteBuilder app)
    {
        var meals = app.MapGroup("/api/v1/meals")
            .RequireAuthorization();

        meals.MapGet("/week", GetWeekAsync);
        meals.MapPost(string.Empty, CreateMealAsync);
        meals.MapPut("/{mealId:guid}", UpdateMealAsync);
        meals.MapGet("/requests", GetRequestsAsync);
        meals.MapPost("/requests", CreateRequestAsync);
        meals.MapPut("/requests/{requestId:guid}/assign", AssignRequestAsync);
        meals.MapPost("/requests/{requestId:guid}/accept", AcceptRequestAsync);

        return app;
    }

    private static async Task<IResult> GetWeekAsync(
        HttpContext httpContext,
        DateOnly? start,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var weekStart = start ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var weekEnd = weekStart.AddDays(6);

        var meals = await dbContext.MealPlans
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId)
            .Where(x => x.MealDate >= weekStart && x.MealDate <= weekEnd)
            .OrderBy(x => x.MealDate)
            .Select(x => new MealPlanResponse(
                x.Id,
                x.MealDate,
                x.Title,
                x.Notes,
                x.OwnerProfileId))
            .ToListAsync(cancellationToken);

        return Results.Ok(new WeeklyMealsResponse(weekStart, weekEnd, meals));
    }

    private static async Task<IResult> CreateMealAsync(
        HttpContext httpContext,
        CreateMealPlanRequest request,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var validation = await ValidateMealRequestAsync(membership.FamilyId, request.Title, request.OwnerProfileId, dbContext, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        var existingMeal = await dbContext.MealPlans.AnyAsync(
            x => x.FamilyId == membership.FamilyId && x.MealDate == request.MealDate,
            cancellationToken);

        if (existingMeal)
        {
            return Results.Conflict(new { message = "A meal is already planned for this day." });
        }

        var mealPlan = new MealPlan
        {
            Id = Guid.NewGuid(),
            FamilyId = membership.FamilyId,
            MealDate = request.MealDate,
            Title = request.Title.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            OwnerProfileId = request.OwnerProfileId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        dbContext.MealPlans.Add(mealPlan);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/v1/meals/{mealPlan.Id}", ToResponse(mealPlan));
    }

    private static async Task<IResult> UpdateMealAsync(
        HttpContext httpContext,
        Guid mealId,
        UpdateMealPlanRequest request,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var validation = await ValidateMealRequestAsync(membership.FamilyId, request.Title, request.OwnerProfileId, dbContext, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        var mealPlan = await dbContext.MealPlans
            .FirstOrDefaultAsync(x => x.Id == mealId && x.FamilyId == membership.FamilyId, cancellationToken);

        if (mealPlan is null)
        {
            return Results.NotFound();
        }

        var existingMeal = await dbContext.MealPlans.AnyAsync(
            x => x.FamilyId == membership.FamilyId && x.MealDate == request.MealDate && x.Id != mealId,
            cancellationToken);

        if (existingMeal)
        {
            return Results.Conflict(new { message = "A meal is already planned for this day." });
        }

        mealPlan.MealDate = request.MealDate;
        mealPlan.Title = request.Title.Trim();
        mealPlan.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        mealPlan.OwnerProfileId = request.OwnerProfileId;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToResponse(mealPlan));
    }

    private static async Task<IResult> GetRequestsAsync(
        HttpContext httpContext,
        DateOnly? start,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var weekStart = start ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var weekEnd = weekStart.AddDays(6);

        var requests = await dbContext.MealRequests
            .AsNoTracking()
            .Where(x => x.FamilyId == membership.FamilyId)
            .Where(x => x.Status == MealRequestStatus.Pending)
            .Where(x => !x.RequestedForDate.HasValue || (x.RequestedForDate >= weekStart && x.RequestedForDate <= weekEnd))
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => ToResponse(x))
            .ToListAsync(cancellationToken);

        return Results.Ok(requests);
    }

    private static async Task<IResult> CreateRequestAsync(
        HttpContext httpContext,
        CreateMealRequestRequest request,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var validation = await ValidateRequestProfilesAsync(
            membership.FamilyId,
            request.Title,
            request.RequesterProfileId,
            null,
            dbContext,
            cancellationToken);

        if (validation is not null)
        {
            return validation;
        }

        var mealRequest = new MealRequest
        {
            Id = Guid.NewGuid(),
            FamilyId = membership.FamilyId,
            RequesterProfileId = request.RequesterProfileId,
            RequestedForDate = request.RequestedForDate,
            Title = request.Title.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Status = MealRequestStatus.Pending,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        dbContext.MealRequests.Add(mealRequest);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/v1/meals/requests/{mealRequest.Id}", ToResponse(mealRequest));
    }

    private static async Task<IResult> AssignRequestAsync(
        HttpContext httpContext,
        Guid requestId,
        AssignMealRequestRequest request,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var validation = await ValidateRequestProfilesAsync(
            membership.FamilyId,
            "assigned meal request",
            null,
            request.AssigneeProfileId,
            dbContext,
            cancellationToken);

        if (validation is not null)
        {
            return validation;
        }

        var mealRequest = await dbContext.MealRequests
            .FirstOrDefaultAsync(x => x.Id == requestId && x.FamilyId == membership.FamilyId, cancellationToken);

        if (mealRequest is null)
        {
            return Results.NotFound();
        }

        if (mealRequest.Status != MealRequestStatus.Pending)
        {
            return Results.Conflict(new { message = "Only pending requests can be assigned." });
        }

        mealRequest.AssigneeProfileId = request.AssigneeProfileId;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToResponse(mealRequest));
    }

    private static async Task<IResult> AcceptRequestAsync(
        HttpContext httpContext,
        Guid requestId,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var mealRequest = await dbContext.MealRequests
            .FirstOrDefaultAsync(x => x.Id == requestId && x.FamilyId == membership.FamilyId, cancellationToken);

        if (mealRequest is null)
        {
            return Results.NotFound();
        }

        if (mealRequest.Status != MealRequestStatus.Pending)
        {
            return Results.Conflict(new { message = "This request has already been accepted." });
        }

        if (mealRequest.RequestedForDate.HasValue)
        {
            var existingMeal = await dbContext.MealPlans.AnyAsync(
                x => x.FamilyId == membership.FamilyId && x.MealDate == mealRequest.RequestedForDate.Value,
                cancellationToken);

            if (existingMeal)
            {
                return Results.Conflict(new { message = "A meal is already planned for this requested day." });
            }

            dbContext.MealPlans.Add(new MealPlan
            {
                Id = Guid.NewGuid(),
                FamilyId = membership.FamilyId,
                MealDate = mealRequest.RequestedForDate.Value,
                Title = mealRequest.Title,
                Notes = mealRequest.Notes,
                OwnerProfileId = mealRequest.AssigneeProfileId,
                CreatedAtUtc = DateTimeOffset.UtcNow,
            });
        }

        mealRequest.Status = MealRequestStatus.Accepted;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToResponse(mealRequest));
    }

    private static async Task<IResult?> ValidateMealRequestAsync(
        Guid familyId,
        string title,
        Guid? ownerProfileId,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return Results.BadRequest(new { message = "Meal title is required." });
        }

        if (!ownerProfileId.HasValue)
        {
            return null;
        }

        var profileExists = await dbContext.Profiles.AnyAsync(
            x => x.Id == ownerProfileId.Value && x.FamilyId == familyId,
            cancellationToken);

        return profileExists
            ? null
            : Results.BadRequest(new { message = "The selected profile does not belong to this family." });
    }

    private static async Task<IResult?> ValidateRequestProfilesAsync(
        Guid familyId,
        string title,
        Guid? requesterProfileId,
        Guid? assigneeProfileId,
        PlannerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return Results.BadRequest(new { message = "Meal request title is required." });
        }

        if (requesterProfileId.HasValue)
        {
            var requesterExists = await dbContext.Profiles.AnyAsync(
                x => x.Id == requesterProfileId.Value && x.FamilyId == familyId,
                cancellationToken);

            if (!requesterExists)
            {
                return Results.BadRequest(new { message = "The selected requester does not belong to this family." });
            }
        }

        if (assigneeProfileId.HasValue)
        {
            var assigneeExists = await dbContext.Profiles.AnyAsync(
                x => x.Id == assigneeProfileId.Value && x.FamilyId == familyId,
                cancellationToken);

            if (!assigneeExists)
            {
                return Results.BadRequest(new { message = "The selected assignee does not belong to this family." });
            }
        }

        return null;
    }

    private static MealPlanResponse ToResponse(MealPlan mealPlan)
    {
        return new MealPlanResponse(
            mealPlan.Id,
            mealPlan.MealDate,
            mealPlan.Title,
            mealPlan.Notes,
            mealPlan.OwnerProfileId);
    }

    private static MealRequestResponse ToResponse(MealRequest mealRequest)
    {
        return new MealRequestResponse(
            mealRequest.Id,
            mealRequest.RequesterProfileId,
            mealRequest.RequestedForDate,
            mealRequest.Title,
            mealRequest.Notes,
            mealRequest.Status.ToString(),
            mealRequest.AssigneeProfileId,
            mealRequest.CreatedAtUtc);
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
