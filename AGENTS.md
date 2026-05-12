# AGENTS Guide

This file is for coding agents. Full conventions and architecture detail are in [`docs/AGENTS.md`](docs/AGENTS.md). Read that file before starting any feature work.

## Purpose

Build and extend a small Family Planner MVP. Preserve the mobile-first UX. Keep implementation simple, local, and easy to verify.

## Stack Summary

- Frontend: React 19, TypeScript, Vite, React Router, TanStack Query, react-i18next
- Backend: ASP.NET Core minimal API on .NET 9
- Database: PostgreSQL via EF Core + Npgsql
- Auth: ASP.NET Identity + JWT access token
- PWA: Workbox service worker, installable, offline read/write support

## Key Rules

- Follow current codebase patterns, not aspirational architecture.
- Never hand-edit EF migrations — always use repo-local `dotnet-ef`.
- Do not trust client-supplied family scope — always load membership from the DB.
- Do not redesign the UI away from the Kinship-style mobile-first layout.
- Do not refactor auth/session storage during unrelated work.
- Invalidate `bootstrap` when mutations affect bootstrap-visible data.

## Verification

```bash
pnpm --filter @planner/web build
dotnet build planner.sln
dotnet test planner.sln
```

## Where to Go Next

- Full conventions, repo layout, endpoint patterns, frontend patterns, i18n, PWA, migrations: [`docs/AGENTS.md`](docs/AGENTS.md)
- Deployment topology and CI/CD: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- Design tokens and visual language: [`docs/DESIGN.md`](docs/DESIGN.md)
