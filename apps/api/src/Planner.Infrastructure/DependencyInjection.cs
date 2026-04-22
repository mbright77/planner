using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Planner.Infrastructure.Persistence;

namespace Planner.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString("Planner")
            ?? "Host=localhost;Port=5432;Database=planner;Username=planner;Password=planner";

        services.AddDbContext<PlannerDbContext>(options => options.UseNpgsql(connectionString));

        return services;
    }
}
