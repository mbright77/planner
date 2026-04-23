namespace Planner.Api.Endpoints;

public static class PlannerEndpoints
{
    public static IEndpointRouteBuilder MapPlannerEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/v1");

        api.MapGet("/ping", () => Results.Ok(new { message = "planner-api" }));

        app.MapAuthEndpoints();
        app.MapBootstrapEndpoints();
        app.MapDashboardEndpoints();
        app.MapProfileEndpoints();
        app.MapShoppingEndpoints();
        app.MapCalendarEndpoints();
        app.MapMealEndpoints();

        if (app.ServiceProvider.GetRequiredService<IHostEnvironment>().IsDevelopment())
        {
            app.MapDevelopmentSeedEndpoints();
        }

        return app;
    }
}
