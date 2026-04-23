using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Planner.Infrastructure.Auth;
using Planner.Infrastructure.Identity;
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

        services.AddIdentityCore<PlannerIdentityUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequireUppercase = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireDigit = true;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<PlannerDbContext>();

        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<ICalendarSeriesMaterializer, CalendarSeriesMaterializer>();

        if (!environment.IsDevelopment())
        {
            services.AddHostedService<CalendarSeriesMaterializationWorker>();
        }

        return services;
    }
}
