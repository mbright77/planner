using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Planner.Api.Extensions;
using Planner.Contracts.Integrations;
using Planner.Domain;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Persistence;

namespace Planner.Api.Endpoints;

public static class CalendarSourceEndpoints
{
    public static IEndpointRouteBuilder MapCalendarSourceEndpoints(this IEndpointRouteBuilder app)
    {
        var calendarSources = app.MapGroup("/api/v1/calendar/sources")
            .RequireAuthorization();

        calendarSources.MapGet(string.Empty, GetCalendarSourcesAsync)
            .Produces<CalendarSourceSettingsResponse>(StatusCodes.Status200OK);
        calendarSources.MapPut(string.Empty, UpdateCalendarSourcesAsync)
            .Produces<CalendarSourceSettingsResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        return app;
    }

    private static async Task<IResult> GetCalendarSourcesAsync(
        HttpContext httpContext,
        PlannerDbContext dbContext,
        IOptions<GoogleOptions> googleOptions,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        var response = await BuildSettingsResponseAsync(
            membership.UserId, dbContext, googleOptions.Value, cancellationToken);

        return Results.Ok(response);
    }

    private static async Task<IResult> UpdateCalendarSourcesAsync(
        HttpContext httpContext,
        UpdateCalendarSourcesRequest request,
        PlannerDbContext dbContext,
        IOptions<GoogleOptions> googleOptions,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(httpContext, dbContext, cancellationToken);
        if (membership is null)
        {
            return Results.NotFound();
        }

        if (!Enum.TryParse<CalendarSourceSelection>(request.Sources, ignoreCase: true, out var selection)
            || !Enum.IsDefined(selection))
        {
            return Results.BadRequest(new { message = "Sources must be one of: Local, Google, Both." });
        }

        if (selection is CalendarSourceSelection.Google or CalendarSourceSelection.Both)
        {
            var connection = await dbContext.GoogleCalendarConnections
                .AsNoTracking()
                .Include(x => x.Subscriptions)
                .FirstOrDefaultAsync(x => x.UserId == membership.UserId, cancellationToken);

            if (connection is null || connection.Status != GoogleConnectionStatus.Connected)
            {
                return Results.BadRequest(new { message = "Connect a healthy Google account before selecting Google calendars." });
            }

            if (!connection.Subscriptions.Any(x => x.IsSelected))
            {
                return Results.BadRequest(new { message = "Select at least one Google calendar before enabling Google sources." });
            }
        }

        var preference = await dbContext.UserCalendarPreferences
            .FirstOrDefaultAsync(x => x.UserId == membership.UserId, cancellationToken);

        if (preference is null)
        {
            preference = new UserCalendarPreference
            {
                Id = Guid.NewGuid(),
                UserId = membership.UserId,
                FamilyId = membership.FamilyId,
            };
            dbContext.UserCalendarPreferences.Add(preference);
        }

        preference.Sources = selection;
        preference.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        var response = await BuildSettingsResponseAsync(
            membership.UserId, dbContext, googleOptions.Value, cancellationToken);

        return Results.Ok(response);
    }

    private static async Task<CalendarSourceSettingsResponse> BuildSettingsResponseAsync(
        string userId,
        PlannerDbContext dbContext,
        GoogleOptions googleOptions,
        CancellationToken cancellationToken)
    {
        var preference = await dbContext.UserCalendarPreferences
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

        var connection = await dbContext.GoogleCalendarConnections
            .AsNoTracking()
            .Include(x => x.Subscriptions)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

        var connectionSummary = connection is null
            ? null
            : new GoogleConnectionSummary(
                connection.GoogleAccountEmail,
                connection.Status.ToString(),
                connection.ConnectedAtUtc,
                connection.CalendarsSyncedAtUtc,
                connection.Subscriptions.Count(x => x.IsSelected));

        return new CalendarSourceSettingsResponse(
            (preference?.Sources ?? CalendarSourceSelection.Local).ToString(),
            googleOptions.IsConfigured,
            connectionSummary);
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
