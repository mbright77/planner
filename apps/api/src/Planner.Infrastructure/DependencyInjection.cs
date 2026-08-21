using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Planner.Infrastructure.Auth;
using Planner.Infrastructure.Calendar;
using Planner.Infrastructure.Identity;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Persistence;
using Planner.Infrastructure.Security;

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

        services.AddDbContext<PlannerDbContext>(options =>
            options.UseNpgsql(
                connectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "public")));

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
        services.AddHostedService<CalendarSeriesMaterializationWorker>();

        services.AddOptions<GoogleOptions>()
            .BindConfiguration(GoogleOptions.SectionName)
            .Validate(
                options => options.HasValidPostConnectRedirectUrl,
                "Google:PostConnectRedirectUrl must be an absolute URL when Google is configured.")
            .Validate(
                options => options.HasValidTokenEncryptionKey,
                "Google:TokenEncryptionKey must be a base64-encoded 32-byte key when Google is configured.")
            .ValidateOnStart();
        services.AddMemoryCache();
        services.AddSingleton<ITokenCipher, AesGcmTokenCipher>();
        services.AddHttpClient<IGoogleOAuthClient, GoogleOAuthClient>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(5);
        });
        services.AddHttpClient<IGoogleCalendarClient, GoogleCalendarClient>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(5);
        });
        services.AddScoped<IGoogleCalendarSubscriptionService, GoogleCalendarSubscriptionService>();
        services.AddScoped<IGoogleAccessTokenProvider, GoogleAccessTokenProvider>();
        services.AddScoped<IGoogleCalendarEventReader, GoogleCalendarEventReader>();
        services.AddScoped<ICalendarAggregator, CalendarAggregator>();

        return services;
    }
}
