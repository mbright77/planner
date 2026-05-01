# AGENTS Guide

This file is for coding agents working in this repository. Prefer the current codebase patterns over the aspirational architecture in `IMPLEMENTATION_PLAN.md` when the two differ. Use the implementation plan as product direction, not as proof that a pattern already exists.

## Purpose

- Build and extend a small Family Planner MVP.
- Preserve the Kinship-style mobile-first UX from `/docs`.
- Keep implementation simple, local, and easy to verify.

## Current Stack

- Frontend: React 19, TypeScript, Vite, React Router, TanStack Query.
- Backend: ASP.NET Core minimal API on .NET 9.
- Database: PostgreSQL via EF Core + Npgsql.
- Auth: ASP.NET Identity + JWT access token.
- Hosting target: static frontend + single-node K3s backend.

## Current Reality vs Target Plan

Some items in `IMPLEMENTATION_PLAN.md` are target-state, not implemented-state.

Current implementation realities:

- Frontend styling uses plain CSS in `apps/web/src/app/styles/index.css`, not Tailwind.
- Frontend forms currently use local `useState`, not React Hook Form + Zod.
- Auth session is currently stored in `localStorage` under `planner.session`, not in-memory access token plus refresh-cookie flow.
- Backend uses feature-grouped minimal API endpoint files directly; `Planner.Application` is mostly a placeholder right now.
- Contracts are still handwritten in `apps/api/src/Planner.Contracts`, but a generated TypeScript API client now exists in `packages/api-client` and is consumed by the web wrappers.

Recent repository changes (important for agents):

- Server now computes canonical week boundaries (`weekStart`) using the family's timezone and returns `DateOnly` for family-local dates (calendar events and meals).
- API payloads and contracts have been updated so clients send `DateOnly` (local date) and, where needed, `TimeOnly` (local time) instead of relying on client-derived UTC boundary computation.
- Frontend conventions: prefer the server-provided `weekStart` for UI week boundaries, group items by the server `date` field, and send `DateOnly`/`TimeOnly` on creates/updates.
- A generated TypeScript API client in `packages/api-client` is used by the web app and should be regenerated whenever contracts change.
- EF Core translation differences (especially with the SQLite test provider) surfaced during these changes; some queries were changed to be provider-friendly (fetch minimal data via EF then apply complex UTC/timezone logic in-memory) — add tests when modifying date/time queries.

When adding new work, follow the current implementation patterns unless the task explicitly asks for a broader architectural migration.

## Implementation Plan Maintenance

`IMPLEMENTATION_PLAN.md` is not just roadmap context; it must be kept in sync with committed work.

Requirements:

- If you complete, partially complete, or materially change planned work, update the relevant checklist items and status notes in `IMPLEMENTATION_PLAN.md` in the same task.
- If current implementation differs from target-state architecture, reflect that clearly in the plan rather than leaving misleading unchecked boxes or outdated assumptions.
- Do not mark a plan item complete unless the work is actually committed in the codebase or intentionally delivered in the current change.
- When you add a new slice or infrastructure milestone, update the plan so another agent can understand what is already done versus still aspirational.

## Repo Layout

Top level:

- `apps/web`: React frontend.
- `apps/api`: .NET backend.
- `docs`: product/design reference.
- `infra`: deployment/infrastructure files.
- `packages`: reserved for shared packages, mostly not active yet.
- `IMPLEMENTATION_PLAN.md`: roadmap and architecture intent.
- `.config/dotnet-tools.json`: repo-local EF tooling.

Backend layout:

- `apps/api/src/Planner.Api`: minimal API host, endpoint definitions, auth wiring.
- `apps/api/src/Planner.Application`: currently minimal placeholder.
- `apps/api/src/Planner.Domain`: domain entities currently live in `AssemblyMarker.cs`.
- `apps/api/src/Planner.Infrastructure`: EF Core, Identity, JWT token service, migrations.
- `apps/api/src/Planner.Contracts`: request/response contract records grouped by feature.

Frontend layout:

- `apps/web/src/app`: shell, router, global styles.
- `apps/web/src/processes`: cross-page flows like auth session and family bootstrap.
- `apps/web/src/pages`: route-level pages.
- `apps/web/src/entities/*/model`: TanStack Query hooks for domain slices.
- `apps/web/src/shared/api`: small handwritten fetch wrappers.
- `apps/web/src/shared/config`: env configuration.

## Product and UX Rules

Always preserve these product rules from `IMPLEMENTATION_PLAN.md` and `/docs`:

- Mobile-first layout.
- Weekly planning is the main pattern for calendar and meals.
- Use soft-card visuals and large touch targets.
- Profile color must never be the only signal.
- Favor quick, screen-oriented CRUD flows over abstract infrastructure.

Do not redesign the UI away from the `/docs` examples unless explicitly asked.

## Backend Conventions

### Endpoint Style

Mirror existing endpoint files such as:

- `apps/api/src/Planner.Api/Endpoints/ProfileEndpoints.cs`
- `apps/api/src/Planner.Api/Endpoints/ShoppingEndpoints.cs`
- `apps/api/src/Planner.Api/Endpoints/CalendarEndpoints.cs`
- `apps/api/src/Planner.Api/Endpoints/MealEndpoints.cs`

Patterns to follow:

- One static endpoint class per feature.
- Expose `MapXEndpoints(this IEndpointRouteBuilder app)`.
- Use route groups under `/api/v1/...`.
- Require auth at the group level for family-scoped features.
- Use `Results.Ok`, `Results.Created`, `Results.NotFound`, `Results.BadRequest`, `Results.Conflict`, `Results.Forbid`.
- Keep handlers small and directly readable.
- Use `CancellationToken` in DB calls.
- Scope all feature data through current family membership.

### Membership and Authorization

Do not trust a family ID from the client for scoping.

Current pattern:

- Read user ID from claims using `httpContext.User.GetRequiredUserId()`.
- Load `FamilyMembership` from `PlannerDbContext`.
- Use `membership.FamilyId` to scope every query/mutation.
- Enforce role checks inline for admin-only actions.

If adding a new family-scoped endpoint, include a helper like the existing `GetMembershipAsync(...)` methods.

### Contracts

Add new request/response records in `apps/api/src/Planner.Contracts/<Feature>/...`.

Current convention:

- Use `public sealed record ...`.
- Keep contracts flat and explicit.
- Match frontend naming closely.
- Return strings for enum-like display status when the frontend only needs display semantics.

### Domain Model

Current state:

- Domain entities and enums are all in `apps/api/src/Planner.Domain/AssemblyMarker.cs`.

Until the codebase is intentionally refactored, keep following that pattern for consistency.

### Persistence

Current EF conventions:

- `PlannerDbContext` in `apps/api/src/Planner.Infrastructure/Persistence/PlannerDbContext.cs`.
- One configuration class per entity in `Persistence/Configurations`.
- Use `builder.ToTable("snake_case_name")`.
- Add indexes in configuration classes.
- Call `base.OnModelCreating(modelBuilder);` before `ApplyConfigurationsFromAssembly(...)`.

When adding entities:

1. Add the entity to `AssemblyMarker.cs`.
2. Add a `DbSet<>` to `PlannerDbContext`.
3. Add a configuration class.
4. Generate a migration using repo-local `dotnet-ef`.

### Infrastructure Registration

Current DI entry points:

- API wiring: `apps/api/src/Planner.Api/DependencyInjection/ServiceCollectionExtensions.cs`
- Infrastructure wiring: `apps/api/src/Planner.Infrastructure/DependencyInjection.cs`
- Application wiring: `apps/api/src/Planner.Application/DependencyInjection.cs`

Keep new service registrations in the matching project-level DI file.

### Error Handling

The implementation plan mentions `ProblemDetails`, but current code often returns anonymous JSON payloads like `{ message = "..." }` for validation/business errors. Follow the current code unless explicitly asked to standardize error handling globally.

## Frontend Conventions

### General Structure

Follow the current layout:

- Route page in `pages/<feature>/<Feature>Page.tsx`
- Fetch helpers in `shared/api/<feature>.ts`
- Query/mutation hooks in `entities/<entity>/model/...`

Current pages tend to own local form state directly and consume entity hooks.

### API Layer

Use the existing `http<T>()` helper in `apps/web/src/shared/api/http.ts`.

Conventions:

- One feature API file per slice.
- Export response/request types from the same file.
- Pass `accessToken` through the helper.
- Use explicit REST paths that mirror backend routes.

### Query Hooks

Mirror patterns in:

- `apps/web/src/entities/profile/model/useProfiles.ts`
- `apps/web/src/entities/shopping-item/model/useShoppingItems.ts`
- `apps/web/src/entities/event/model/useCalendarWeek.ts`
- `apps/web/src/entities/meal/model/useMealsWeek.ts`

Conventions:

- Use TanStack Query.
- Include `session?.accessToken` in query keys for auth-scoped data.
- Use `enabled: Boolean(session?.accessToken)` on protected queries.
- Invalidate the smallest practical query set on mutation success.
- Invalidate `bootstrap` when a mutation changes profile data or other bootstrap-visible data.

### Page Composition

Current page style:

- Use simple `useState` forms.
- Use `useMemo` for grouping or lookup maps where helpful.
- Show loading and error states inline using existing class names like `page-copy` and `form-error`.
- Keep JSX explicit and readable over over-abstracted.

### Styling

Current styling lives in `apps/web/src/app/styles/index.css`.

Conventions:

- Reuse existing utility-like class names before adding new ones.
- Add new feature classes to `index.css` in the same style as existing ones.
- Preserve the existing visual language: soft cards, rounded corners, subtle borders, light blue palette.
- Respect mobile-first layout; desktop enhancements go in media queries.

Do not introduce Tailwind just because the implementation plan mentions it.

### Routing and Shell

Current app shell and routes:

- Router: `apps/web/src/app/router/AppRouter.tsx`
- Shell: `apps/web/src/app/layouts/AppShell.tsx`

Conventions:

- Protected app routes render under `AppShell`.
- Bottom nav items are hardcoded in `AppShell`.
- New first-class pages usually need both a route and a nav decision.

## Authentication Notes

Current auth state:

- API URLs default to `http://localhost:5254`.
- Frontend session key is `planner.session`.
- Session is persisted in `localStorage` in `AuthSessionContext.tsx`.
- JWT bearer auth is configured in `Planner.Api/DependencyInjection/ServiceCollectionExtensions.cs`.

This is a known MVP simplification. Do not silently refactor auth storage or session semantics while doing unrelated work.

## Database and Migration Rules

These are strict:

- Never hand-write or manually edit EF migration files.
- Always use repo-local tooling.

Commands:

```bash
dotnet tool restore
dotnet dotnet-ef migrations add <MeaningfulName> --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj --startup-project apps/api/src/Planner.Api/Planner.Api.csproj --output-dir Persistence/Migrations
dotnet dotnet-ef database update --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj --startup-project apps/api/src/Planner.Api/Planner.Api.csproj
```

Important:

- The repo uses `dotnet-ef` version `9.0.10` from `.config/dotnet-tools.json`.
- If tooling fails, fix tooling first, then rerun the command.

## Verification Workflow

For most feature work, run the smallest useful full verification set:

Frontend:

```bash
pnpm --filter @planner/web build
```

Backend:

```bash
dotnet build planner.sln
dotnet test planner.sln
```

Notes:

- Solution build/test are currently expected to pass.
- The frontend workspace has `build`, `lint`, `format`, and `typecheck` scripts.
- Root `just test` runs `pnpm test` and `dotnet test planner.sln`.

## Existing Feature Slices

Implemented and usable today:

- Auth register/login
- Bootstrap
- Profiles
- Shopping
- Calendar
- Meals
- Meal requests

When adding adjacent work, inspect the nearest existing slice and mirror it instead of inventing a new pattern.

## Current Technical Debt and Known Deviations

Be aware of these before making changes:

- `Planner.Application` exists but does not yet contain real vertical-slice handlers.
- `Planner.Domain/AssemblyMarker.cs` is carrying all entities, which is not ideal but is current convention.
- Error payloads are not standardized yet.
- The login page is still a placeholder relative to the implementation plan.
- The roadmap mentions generated API clients, offline queueing, refresh cookies, and Tailwind, but those are not current implementation patterns.

Do not “fix” these as incidental cleanup unless the task is explicitly about them.

## Recommended Agent Workflow

When implementing a feature:

1. Read the relevant section in `IMPLEMENTATION_PLAN.md` and matching `/docs` HTML mockup.
2. Inspect the closest existing slice in both frontend and backend.
3. Prefer extending current patterns over introducing target-state architecture early.
4. Keep changes small and end-to-end.
5. Generate migrations only through EF commands.
6. Update `IMPLEMENTATION_PLAN.md` if the implementation changed delivered scope, checklist status, or current-state notes.
7. Run build/tests before finishing.

## Good Defaults for New Features

If you add a new slice today, the default should look like this:

- Backend:
  - add contracts in `Planner.Contracts/<Feature>`
  - add/extend entity in `Planner.Domain/AssemblyMarker.cs`
  - add EF config in `Planner.Infrastructure/Persistence/Configurations`
  - add minimal API file in `Planner.Api/Endpoints`
  - register endpoint in `PlannerEndpoints.cs`
  - generate migration if schema changed

- Frontend:
  - add API wrapper in `shared/api/<feature>.ts`
  - add TanStack Query hooks in `entities/<entity>/model`
  - add/update route page in `pages/<feature>`
  - add CSS classes in `app/styles/index.css`
  - use `useBootstrap()` when profile/family display context is needed

## Files Worth Reading First

- `IMPLEMENTATION_PLAN.md`
- `apps/api/src/Planner.Api/Program.cs`
- `apps/api/src/Planner.Api/Endpoints/PlannerEndpoints.cs`
- `apps/api/src/Planner.Api/Endpoints/ProfileEndpoints.cs`
- `apps/api/src/Planner.Api/Endpoints/ShoppingEndpoints.cs`
- `apps/api/src/Planner.Api/Endpoints/CalendarEndpoints.cs`
- `apps/api/src/Planner.Api/Endpoints/MealEndpoints.cs`
- `apps/api/src/Planner.Infrastructure/DependencyInjection.cs`
- `apps/api/src/Planner.Infrastructure/Persistence/PlannerDbContext.cs`
- `apps/web/src/app/router/AppRouter.tsx`
- `apps/web/src/app/layouts/AppShell.tsx`
- `apps/web/src/processes/auth-session/AuthSessionContext.tsx`
- `apps/web/src/processes/family-bootstrap/useBootstrap.ts`
- `apps/web/src/app/styles/index.css`

## Avoid These Mistakes

- Do not hand-edit migrations.
- Do not add a new architectural layer just for one feature.
- Do not refactor auth/session storage during unrelated work.
- Do not introduce Tailwind-based patterns into the existing plain-CSS pages unless the task is a styling migration.
- Do not trust client-supplied family scope.
- Do not skip `bootstrap` invalidation when mutations affect bootstrap-visible data.
- Do not redesign the Kinship-inspired UI into a generic admin dashboard.
