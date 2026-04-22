using Planner.Application;
using Planner.Infrastructure;

namespace Planner.Api.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApi(this IServiceCollection services)
    {
        services.AddOpenApi();

        return services;
    }

    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        return services.AddApplicationServices();
    }

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        return services.AddInfrastructureServices(configuration, environment);
    }
}
