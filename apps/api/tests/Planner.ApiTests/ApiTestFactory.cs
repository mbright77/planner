using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Planner.ApiTests.Fakes;
using Planner.Infrastructure.Integrations.Google;
using Planner.Infrastructure.Persistence;

namespace Planner.ApiTests;

public class ApiTestFactory : WebApplicationFactory<Program>
{
    private SqliteConnection? _connection;

    public FakeGoogleOAuthClient FakeGoogleOAuthClient { get; } = new();

    // Empty by default so existing tests keep seeing the feature as unconfigured, matching
    // production with a blank Google section. GoogleConfiguredApiTestFactory overrides this.
    protected virtual IDictionary<string, string?> GoogleConfigurationOverrides => new Dictionary<string, string?>();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(GoogleConfigurationOverrides);
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll(typeof(DbContextOptions<PlannerDbContext>));
            services.RemoveAll(typeof(IDbContextOptionsConfiguration<PlannerDbContext>));
            services.RemoveAll(typeof(PlannerDbContext));

            _connection = new SqliteConnection("Data Source=:memory:");
            _connection.Open();

            services.AddDbContext<PlannerDbContext>(options => options.UseSqlite(_connection));

            services.RemoveAll<IGoogleOAuthClient>();
            services.AddSingleton<IGoogleOAuthClient>(FakeGoogleOAuthClient);

            var serviceProvider = services.BuildServiceProvider();

            using var scope = serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();
            dbContext.Database.EnsureCreated();
        });
    }

    public async Task ResetDatabaseAsync()
    {
        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlannerDbContext>();

        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();

        FakeGoogleOAuthClient.Reset();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (!disposing)
        {
            return;
        }

        _connection?.Dispose();
        _connection = null;
    }
}
