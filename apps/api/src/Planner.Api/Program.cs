using Planner.Api.DependencyInjection;
using Planner.Api.Endpoints;
using Planner.Api.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using System.Data.Common;
using Planner.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApi(builder.Configuration, builder.Environment)
    .AddApplication()
    .AddInfrastructure(builder.Configuration, builder.Environment);

var app = builder.Build();
var pathBase = builder.Configuration.GetValue<string>("PathBase");

// Optionally run EF Core migrations on startup. Controlled by the
// RunMigrationsOnStartup configuration key (default: false).
// When enabled, this will attempt to acquire a Postgres advisory lock
// so only one instance applies migrations, then call Database.MigrateAsync().
var runMigrations = bool.TryParse(app.Configuration["RunMigrationsOnStartup"], out var _run) && _run;
if (runMigrations)
{
    await ApplyMigrationsWithAdvisoryLockAsync(app);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseForwardedHeaders();

if (!string.IsNullOrWhiteSpace(pathBase))
{
    app.UsePathBase(pathBase);
}

app.UseHttpsRedirection();
app.UseCors(ServiceCollectionExtensions.GetFrontendClientPolicyName());
app.UseMiddleware<SecurityHeadersMiddleware>();
if (!app.Environment.IsEnvironment("Testing"))
{
    app.UseRateLimiter();
}
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthEndpoints();
app.MapPlannerEndpoints();

app.Run();

public partial class Program;

static async Task ApplyMigrationsWithAdvisoryLockAsync(WebApplication app,
    int maxAttempts = 5,
    int initialDelayMs = 1000,
    long advisoryLockKey = 1234567890L)
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var db = services.GetRequiredService<PlannerDbContext>();

    int attempt = 0;
    while (true)
    {
        attempt++;
        try
        {
            var conn = db.Database.GetDbConnection();
            await conn.OpenAsync();

            // Try to obtain advisory lock so only one instance runs migrations.
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT pg_try_advisory_lock(@lockKey);";
                var p = cmd.CreateParameter();
                p.ParameterName = "lockKey";
                p.Value = advisoryLockKey;
                cmd.Parameters.Add(p);

                var res = await cmd.ExecuteScalarAsync();
                var gotLock = res is bool b && b;
                if (!gotLock)
                {
                    logger.LogInformation("Another instance holds the migration lock; skipping migrations on this instance.");
                }
                else
                {
                    logger.LogInformation("Acquired advisory lock ({LockKey}). Applying EF migrations...", advisoryLockKey);

                    // Apply any pending migrations. This will create the database/schema
                    // objects if the connected user has sufficient privileges.
                    await db.Database.MigrateAsync();

                    // Release the advisory lock.
                    using var releaseCmd = conn.CreateCommand();
                    releaseCmd.CommandText = "SELECT pg_advisory_unlock(@lockKey);";
                    var rp = releaseCmd.CreateParameter();
                    rp.ParameterName = "lockKey";
                    rp.Value = advisoryLockKey;
                    releaseCmd.Parameters.Add(rp);
                    await releaseCmd.ExecuteNonQueryAsync();

                    logger.LogInformation("Migrations applied and advisory lock released.");
                }
            }

            await conn.CloseAsync();
            break;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Migration attempt {Attempt} failed.", attempt);
            if (attempt >= maxAttempts)
            {
                logger.LogCritical("Exceeded max migration attempts ({MaxAttempts}). Aborting startup.", maxAttempts);
                throw; // Crash startup — prefer failing fast so the failure is visible and fixable
            }

            var delay = initialDelayMs * (int)Math.Pow(2, attempt - 1);
            logger.LogInformation("Retrying migrations in {DelayMs}ms...", delay);
            try
            {
                await Task.Delay(delay);
            }
            catch
            {
                // ignore cancellation during shutdown
            }
        }
    }
}
