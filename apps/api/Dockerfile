FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY . .

RUN dotnet restore apps/api/src/Planner.Api/Planner.Api.csproj
RUN dotnet publish apps/api/src/Planner.Api/Planner.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "Planner.Api.dll"]
