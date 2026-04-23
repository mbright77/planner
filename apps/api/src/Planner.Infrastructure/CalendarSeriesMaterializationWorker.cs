using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Planner.Infrastructure.Persistence;

namespace Planner.Infrastructure;

public sealed class CalendarSeriesMaterializationWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<CalendarSeriesMaterializationWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);
    private const int MaterializationWindowDays = 56;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await MaterializePendingSeriesAsync(stoppingToken);

        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await MaterializePendingSeriesAsync(stoppingToken);
        }
    }

    private async Task MaterializePendingSeriesAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
            var materializer = scope.ServiceProvider.GetRequiredService<ICalendarSeriesMaterializer>();
            var targetLimit = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(MaterializationWindowDays);

            var seriesList = await dbContext.CalendarEventSeries
                .Where(x => x.MaterializedThrough < x.RepeatUntil)
                .Where(x => x.MaterializedThrough < targetLimit)
                .ToListAsync(cancellationToken);

            foreach (var series in seriesList)
            {
                await materializer.MaterializeFutureOccurrencesAsync(
                    dbContext,
                    series,
                    series.MaterializedThrough.AddDays(1),
                    cancellationToken);
            }

            if (dbContext.ChangeTracker.HasChanges())
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unable to materialize recurring calendar events.");
        }
    }
}
