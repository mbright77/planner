using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Planner.Infrastructure.Persistence.DesignTime;

public sealed class PlannerDbContextFactory : IDesignTimeDbContextFactory<PlannerDbContext>
{
    public PlannerDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<PlannerDbContext>();
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__Planner") ??
            "Host=localhost;Port=5432;Database=planner;Username=planner;Password=planner";

        optionsBuilder.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "public"));

        return new PlannerDbContext(optionsBuilder.Options);
    }
}
