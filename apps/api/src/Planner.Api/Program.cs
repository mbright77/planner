using Planner.Api.DependencyInjection;
using Planner.Api.Endpoints;
using Planner.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApi(builder.Configuration, builder.Environment)
    .AddApplication()
    .AddInfrastructure(builder.Configuration, builder.Environment);

var app = builder.Build();
var pathBase = builder.Configuration.GetValue<string>("PathBase");

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
