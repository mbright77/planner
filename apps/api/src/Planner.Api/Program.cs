using Planner.Api.DependencyInjection;
using Planner.Api.Endpoints;
using Planner.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApi(builder.Configuration, builder.Environment)
    .AddApplication()
    .AddInfrastructure(builder.Configuration, builder.Environment);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
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
