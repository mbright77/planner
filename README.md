# Family Planner

A mobile-first family planning app. Shared calendar, weekly meals, and shopping list — all in one place.

## Live

- App: [https://mbright77.github.io/planner/](https://mbright77.github.io/planner/)
- API: [https://hub.brightmatter.net/planner-api](https://hub.brightmatter.net/planner-api)

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Query |
| Backend | ASP.NET Core minimal API, .NET 9 |
| Database | PostgreSQL via EF Core |
| Auth | ASP.NET Identity + JWT |
| PWA | Workbox, offline read/write |
| Hosting | GitHub Pages (frontend) + K3s (backend) |

## Local Development

### Prerequisites

- Node.js 20+ and pnpm
- .NET 9 SDK
- Docker (for PostgreSQL)

### Start everything

```bash
# Start PostgreSQL
docker compose up -d

# Install JS dependencies
pnpm install

# Start backend (http://localhost:5254)
dotnet run --project apps/api/src/Planner.Api

# Start frontend (http://localhost:5173)
pnpm --filter @planner/web dev
```

### Verify

```bash
pnpm --filter @planner/web build
dotnet build planner.sln
dotnet test planner.sln
```

## Documentation

- [`docs/AGENTS.md`](docs/AGENTS.md) — architecture and conventions for coding agents
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deployment topology and CI/CD
- [`docs/DESIGN.md`](docs/DESIGN.md) — design tokens and visual language
