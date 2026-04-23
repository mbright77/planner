# Family Planner PWA Implementation Plan

## Source Context

This plan is based on the UX and design materials under `/docs`, especially:

- `docs/DESIGN.md`
- `docs/app_overview_user_flows.md`
- `docs/stitch_kinship_family_planner/home_dashboard/code.html`
- `docs/stitch_kinship_family_planner/weekly_calendar/code.html`
- `docs/stitch_kinship_family_planner/meals_planner/code.html`
- `docs/stitch_kinship_family_planner/shopping_list/code.html`
- `docs/stitch_kinship_family_planner/profiles_management/code.html`

The implementation must preserve the provided UI direction:

- Mobile-first PWA with bottom navigation and FAB-driven quick actions
- Weekly planning as the primary interaction pattern for calendar and meals
- Color-coded family identity with avatar and text-based dual signaling
- Soft-card, warm, high-clarity Kinship UI visual language
- Large touch targets and fast interactions optimized for one-handed use

## Current Implementation Snapshot

This document mixes target-state architecture with committed work already on `main`.

Current committed reality:

- The monorepo, solution structure, frontend app shell, and API host are in place
- Authentication is implemented with register/login plus JWT access tokens, but not refresh-token cookies
- The frontend currently stores session data in `localStorage`, not in-memory auth state
- The frontend uses plain CSS and local `useState` forms, not Tailwind or React Hook Form
- Core first-pass slices are committed for profiles, shopping, calendar, meals, and meal requests
- The home dashboard, generated API client, IndexedDB-backed offline support, and weekly recurring calendar events are implemented
- CI/CD and real infra manifests are not implemented yet

Use the sections below as product direction, but treat the notes marked "Current committed state" as the source of truth for what exists today.

---

## 1. Architecture

### Recommended Stack

- Frontend: React + TypeScript + Vite PWA
- Backend: ASP.NET Core Web API
- Database: PostgreSQL
- Frontend hosting: Google Pages static hosting target
- Backend hosting: single-node K3s on a VPS using the existing ingress in namespace `brightroom`

### Architecture Summary

- Use a monorepo with separate deployable applications for `web` and `api`
- Use Feature-Sliced Architecture on the frontend
- Use Vertical Slice Architecture on the backend, implemented within clear Clean Architecture boundaries
- Use REST APIs with screen-optimized read models
- Use PostgreSQL as the source of truth for all operational data
- Optimize for a small MVP used by a few families

### Why This Architecture

- React PWA best fits the mobile-first and installable app requirement
- REST is the best fit for these CRUD-heavy and screen-driven workflows
- Vertical Slice Architecture aligns backend code with real business features such as calendar, meals, shopping, and profiles
- Clean boundaries preserve maintainability and testability
- PostgreSQL is the right fit for relational family data, concurrency, and time-based queries
- The implementation intentionally avoids premature complexity so the team can ship and iterate quickly

### System Diagram

```text
[User Browser / Installed PWA]
        |
        | HTTPS
        v
[Google Pages Static Host]
        |
        | API calls
        v
[Ingress on single-node K3s]
        |
        v
[planner-api Deployment]
        |
        +----> [PostgreSQL]
        |
        +----> [In-process BackgroundService]
```

### Monorepo Recommendation

- Keep the entire product in one repository
- Share design tokens, API client generation, linting rules, and scripts through workspace packages
- Keep infrastructure manifests and CI definitions versioned alongside the application code
- Do not introduce Nx or Turborepo for the MVP

Current committed state:

- `apps`, `packages`, `infra`, `planner.sln`, `package.json`, `pnpm-workspace.yaml`, `.editorconfig`, and `justfile` are present
- `packages/design-tokens` exists but is still a placeholder
- `packages/api-client` contains the generated TypeScript API client consumed by the web wrappers
- `infra/k8s` and `infra/github` exist, but currently only contain README placeholders

### Monorepo Structure

```text
/
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  ├─ design-tokens/
│  ├─ api-client/
│  ├─ eslint-config/
│  └─ tsconfig/
├─ infra/
│  ├─ k8s/
│  ├─ github/
│  └─ scripts/
├─ docs/
├─ planner.sln
├─ package.json
├─ pnpm-workspace.yaml
├─ .editorconfig
└─ justfile
```

---

## 2. Frontend Plan

### Frontend Stack

- React 19 + TypeScript + Vite
- React Router
- TanStack Query
- Zustand
- React Hook Form + Zod
- Tailwind CSS + CSS variables
- Radix UI primitives + `Vaul` for bottom sheets
- Dexie for IndexedDB
- `vite-plugin-pwa` with Workbox

Current committed state:

- Implemented stack: React 19, TypeScript, Vite, React Router, TanStack Query
- Not yet implemented in committed app code: Zustand, React Hook Form, Zod-driven forms, Tailwind, Radix UI, Vaul, Dexie, `vite-plugin-pwa`

### Why These Choices

- The mockups are already highly compatible with Tailwind-style utility composition
- TanStack Query is ideal for server-state synchronization and optimistic updates
- Zustand is sufficient for lightweight client-side UI state
- React Hook Form + Zod is fast, type-safe, and mobile friendly
- Radix primitives and `Vaul` provide accessible interaction patterns without forcing a visual design system

### State Management Strategy

- Server state: TanStack Query
- Local UI state: Zustand
- Form state: React Hook Form
- Offline persistence: IndexedDB via Dexie
- Auth state: in-memory access token with cookie-backed refresh flow

Current committed state:

- Server state uses TanStack Query
- Form state currently uses local component `useState`
- Auth state is persisted in `localStorage` under `planner.session`
- Protected reads are cached in IndexedDB and selected mutations queue locally for replay on reconnect

### Routing Structure

```text
/
├─ /login
├─ /invite/:token
├─ /
├─ /calendar
├─ /meals
├─ /shopping
├─ /family
├─ /settings/privacy
└─ /settings/account
```

### Routing Rules

- Keep a shared app shell with top bar and bottom navigation
- Use search params for modal and sheet routing so browser back navigation behaves correctly
- Examples:
  - `/calendar?sheet=create-event&date=2026-04-22`
  - `/shopping?sheet=add-item`

Current committed state:

- Shared app shell, protected routing, and bottom navigation are implemented
- Search-param driven sheet routing is not implemented yet
- Current committed routes are `/login`, `/invite/:token`, `/`, `/calendar`, `/meals`, `/shopping`, and `/family`

### Feature-Sliced Architecture

```text
apps/web/src/
├─ app/
│  ├─ providers/
│  ├─ router/
│  ├─ styles/
│  ├─ layouts/
│  └─ bootstrap/
├─ processes/
│  ├─ auth-session/
│  ├─ family-bootstrap/
│  └─ offline-sync/
├─ pages/
│  ├─ home/
│  ├─ calendar/
│  ├─ meals/
│  ├─ shopping/
│  ├─ family/
│  ├─ login/
│  └─ invite/
├─ features/
│  ├─ auth/sign-in/
│  ├─ calendar/create-event/
│  ├─ calendar/edit-event/
│  ├─ meals/plan-week/
│  ├─ meals/respond-to-request/
│  ├─ shopping/add-item/
│  ├─ shopping/toggle-item/
│  ├─ profiles/create-profile/
│  ├─ profiles/edit-profile/
│  └─ consent/acknowledge-essential-cookies/
├─ entities/
│  ├─ family/
│  ├─ profile/
│  ├─ event/
│  ├─ meal/
│  ├─ shopping-item/
│  └─ user/
└─ shared/
   ├─ api/
   ├─ config/
   ├─ lib/
   ├─ model/
   ├─ ui/
   ├─ styles/
   └─ assets/
```

Current committed state:

- The repo follows the broad `app`, `processes`, `pages`, `entities`, and `shared` shape
- `features/*` folders and shared UI primitive layers are not committed yet
- Current pages own their form state directly and use query hooks from `entities/*/model`

### Component Architecture

- `shared/ui`: generic primitives like `Button`, `Input`, `Card`, `Dialog`, `Sheet`, `Avatar`, `Chip`
- `entities/*/ui`: domain-aware display components like `ProfileChip`, `CalendarEventCard`, `ShoppingItemRow`
- `features/*`: user actions and composed form flows like `CreateEventSheet`, `AddShoppingItemInline`, `AcceptMealRequest`
- `pages/*`: page composition only

### API Client

- Use REST instead of GraphQL
- Publish OpenAPI from ASP.NET Core
- Generate a typed TypeScript client into `packages/api-client`
- Wrap generated calls with auth handling and TanStack Query hooks

Current committed state:

- REST endpoints and development OpenAPI publishing are implemented
- `packages/api-client` contains a generated OpenAPI client and the frontend wrappers in `apps/web/src/shared/api` consume it

### PWA Setup

- Precache app shell, manifest, icons, self-hosted fonts, and critical assets
- Use Workbox caching strategies
- Prompt users when a new version is available

### Offline Support Strategy

#### MVP

- Cache dashboard overview
- Cache calendar weekly data
- Cache meals weekly data
- Cache shopping list data
- Support offline queue for:
  - shopping item add
  - shopping item toggle
  - simple meal request creation

#### Later

- Add offline event creation/edit conflict handling
- Add offline meal editing with explicit reconciliation rules

### Caching Strategy

- Static assets: `CacheFirst`
- API GET requests: `NetworkFirst` with fallback to IndexedDB-backed cached state
- Mutations: queue offline actions with idempotency keys and replay on reconnect
- Show stale/offline UI indicators clearly

### Styling Approach

- Tailwind CSS with CSS variables backed by Kinship UI design tokens
- Extract colors, typography, radius, and spacing into `packages/design-tokens`
- Do not use Material UI or other heavyweight UI frameworks that would conflict with the mockup language

Current committed state:

- Styling lives in `apps/web/src/app/styles/index.css`
- `packages/design-tokens` exists, but is not yet driving the frontend styles

### Forms

- Use React Hook Form + Zod
- Use inline validation for quick add interactions
- Use full field-level validation in creation and edit sheets
- Persist unsaved drafts locally where it improves mobile usability

Current committed state:

- Forms currently use simple local state and lightweight inline guards
- Zod schemas, React Hook Form integration, and draft persistence are not implemented yet

### Modals and Bottom Sheets

- Use bottom sheets on mobile
- Use centered dialogs on tablet and desktop
- Keep both backed by the same accessible primitive and feature logic
- Always support focus trapping, escape, and history-aware dismissal

### Real-Time Updates

- Do not include real-time infrastructure in the initial MVP
- Use optimistic updates plus TanStack Query revalidation for collaborative screens
- Add lightweight polling on shopping and meal request screens only if real usage shows stale-data friction

### Frontend Performance Rules

- Prefer aggregated read endpoints over many small requests
- Self-host fonts rather than loading them at runtime
- Keep icon bundles small
- Run basic mobile Lighthouse checks before release, without building a heavy performance gate prematurely

---

## 3. Backend Plan

### Backend Architecture Choice

- Use Vertical Slice Architecture with explicit API, Application, Domain, and Infrastructure projects

Current committed state:

- The solution has separate API, Application, Domain, Infrastructure, and Contracts projects
- Runtime feature logic currently lives mostly in minimal API endpoint files rather than Application-layer slice handlers
- Domain entities currently live together in `Planner.Domain/AssemblyMarker.cs`

### Why Vertical Slice

- The app is feature-centric rather than workflow-agnostic
- Each feature has distinct commands, queries, validation, and read models
- This reduces unnecessary abstraction and keeps code aligned with product behavior

### Backend Structure

```text
apps/api/
├─ src/
│  ├─ Planner.Api/
│  │  ├─ Endpoints/
│  │  ├─ Middleware/
│  │  ├─ DependencyInjection/
│  │  └─ Program.cs
│  ├─ Planner.Application/
│  │  ├─ Calendar/
│  │  ├─ Meals/
│  │  ├─ Shopping/
│  │  ├─ Profiles/
│  │  ├─ Families/
│  │  ├─ Auth/
│  │  └─ Common/
│  ├─ Planner.Domain/
│  │  ├─ Calendar/
│  │  ├─ Meals/
│  │  ├─ Shopping/
│  │  ├─ Profiles/
│  │  ├─ Families/
│  │  └─ Common/
│  ├─ Planner.Infrastructure/
│  │  ├─ Persistence/
│  │  ├─ Identity/
│  │  ├─ Realtime/
│  │  ├─ BackgroundJobs/
│  │  └─ Migrations/
│  └─ Planner.Contracts/
└─ tests/
   ├─ Planner.UnitTests/
   ├─ Planner.IntegrationTests/
   └─ Planner.ApiTests/
```

Current committed state:

- The project boundaries and test projects exist
- `Planner.Application` is mostly placeholder structure today
- The test projects exist, but current committed coverage is still minimal and mostly scaffold-level

### API Design Recommendation

- Use RESTful APIs with ASP.NET Core minimal APIs
- Group endpoints by feature
- Version routes under `/api/v1`
- Return `ProblemDetails` for errors

Current committed state:

- RESTful minimal APIs under `/api/v1` are implemented
- Endpoints are grouped by feature in `Planner.Api/Endpoints`
- Error responses are currently mixed: some use `ProblemDetails`, many use simple `{ message = ... }` payloads

### Endpoint Structure

- `/api/v1/auth`
- `/api/v1/me`
- `/api/v1/families`
- `/api/v1/families/{familyId}/dashboard`
- `/api/v1/families/{familyId}/profiles`
- `/api/v1/families/{familyId}/events`
- `/api/v1/families/{familyId}/meals`
- `/api/v1/families/{familyId}/meal-requests`
- `/api/v1/families/{familyId}/shopping`
- `/api/v1/families/{familyId}/shopping/categories`
- `/api/v1/consent`

Current committed state:

- Implemented groups include `/api/v1/auth`, `/api/v1/me`, `/api/v1/profiles`, `/api/v1/shopping`, `/api/v1/calendar`, and `/api/v1/meals`
- Implemented groups include `/api/v1/auth`, `/api/v1/me`, `/api/v1/profiles`, `/api/v1/shopping`, `/api/v1/calendar`, `/api/v1/meals`, `/api/v1/family-invites`, and `/api/v1/invites`
- The current API does not pass `familyId` in routes; handlers derive family scope from the authenticated membership
- Dashboard endpoints are implemented
- Consent, families, and shopping category endpoints are not implemented yet

### Read Model Endpoints

- `GET /families/{familyId}/dashboard/overview?date=...`
- `GET /families/{familyId}/calendar/week?start=...`
- `GET /families/{familyId}/meals/week?start=...`
- `GET /families/{familyId}/shopping/list`
- `GET /families/{familyId}/profiles`

Current committed state:

- Weekly calendar and meals read models are implemented
- Profiles and shopping currently return simple feature-scoped lists rather than the planned family-route read models
- Dashboard overview read model is implemented

### Authentication and Authorization

- Use ASP.NET Core Identity for account management
- Use short-lived JWT access tokens for API requests
- Use rotating refresh tokens in secure `HttpOnly` cookies
- Start with email/password authentication
- Use roles:
  - `FamilyAdmin`
  - `FamilyMember`

Current committed state:

- ASP.NET Core Identity, email/password auth, JWT access tokens, and membership roles are implemented
- The current role enum is `Admin` and `Member`
- Refresh tokens, refresh cookies, logout/session revocation flows, and multi-session management are not implemented yet

### Family and User Model

- `User` represents a login account
- `Profile` represents a family person inside the planner
- A profile may optionally link to a user account
- A child can have a profile without a login account
- For MVP, a user belongs to one family

### Validation Strategy

- Frontend: Zod for user-friendly validation
- Backend: FluentValidation for all commands and queries
- Database: constraints as final enforcement

Current committed state:

- Validation is currently inline in pages and endpoints
- Zod and FluentValidation are not wired into committed flows yet

### Logging and Error Handling

- Use structured JSON logging to console
- Add correlation IDs per request
- Use global exception middleware
- Map errors to `ProblemDetails`
- Return validation errors with field details
- Log fatal and startup failures to console only

Current committed state:

- No correlation ID middleware or global exception middleware is committed yet
- Error handling is mostly local to endpoints

### Background Jobs

For this MVP, run background tasks inside the API container using `BackgroundService` or `IHostedService`.

Guidelines:

- Keep jobs short, infrequent, and idempotent
- Keep them inside the API process for the MVP

Use in-process background tasks only where needed:

- recurring event materialization for future weeks
- refresh token cleanup
- GDPR account/family deletion jobs
- optional cleanup of archived shopping items

Current committed state:

- An in-process background worker materializes future recurring calendar event instances
- Refresh token cleanup, GDPR deletion jobs, and shopping archival cleanup are not implemented yet

### EF Core Migrations Policy

- All database creation and schema changes must be handled through EF Core migrations
- Do not create or modify migration files manually
- Generate migrations using `dotnet ef` commands only
- Apply migrations through `dotnet ef database update` locally and through the migration job in production
- If `dotnet ef` commands fail because required tooling is missing, install the missing EF Core tools before proceeding
- Use the repo-local tool manifest rather than assuming a global EF tool installation

Recommended commands:

```bash
dotnet tool restore
dotnet dotnet-ef migrations add InitialCreate --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj --startup-project apps/api/src/Planner.Api/Planner.Api.csproj --output-dir Persistence/Migrations
dotnet dotnet-ef database update --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj --startup-project apps/api/src/Planner.Api/Planner.Api.csproj
```

For future schema changes:

```bash
dotnet tool restore
dotnet dotnet-ef migrations add <MeaningfulMigrationName> --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj --startup-project apps/api/src/Planner.Api/Planner.Api.csproj --output-dir Persistence/Migrations
dotnet dotnet-ef database update --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj --startup-project apps/api/src/Planner.Api/Planner.Api.csproj
```

---

## 4. Database Design

### Database Recommendation

- PostgreSQL 16+
- Store timestamps in UTC
- Store the family timezone explicitly
- Use `NodaTime` in .NET for timezone-safe logic
- For MVP, use a single small PostgreSQL instance with reliable backups

Current committed state:

- PostgreSQL via EF Core is implemented and family timezone is stored on `Family`
- The code currently uses built-in `DateTimeOffset` and `DateOnly`, not `NodaTime`

### Why PostgreSQL

- Strong support for relational data and integrity
- Excellent indexing for date and range queries
- Mature .NET ecosystem support
- Strong concurrency guarantees for collaborative list editing

### Schema Overview

```text
auth.users
auth.refresh_tokens

planner.families
planner.family_memberships
planner.profiles
planner.family_invites

planner.event_series
planner.calendar_events
planner.calendar_event_profiles

planner.meal_plans
planner.meal_requests

planner.shopping_lists
planner.shopping_categories
planner.shopping_items

planner.user_consents
planner.audit_events
```

Current committed state:

- Implemented core tables/entities cover families, family memberships, profiles, calendar event series, calendar events, shopping items, meal plans, and meal requests
- Family invites are implemented for admin-created adult onboarding links
- Refresh tokens, shopping lists, shopping categories, user consents, and audit events are not implemented yet

### Key Tables

#### `families`

- `id`
- `name`
- `timezone`
- `created_by_user_id`
- `created_at`

#### `family_memberships`

- `id`
- `family_id`
- `user_id`
- `role`
- `status`
- `created_at`

#### `profiles`

- `id`
- `family_id`
- `display_name`
- `avatar_url`
- `color_key`
- `linked_user_id` nullable
- `is_active`

#### `event_series`

- recurrence metadata for repeating events

#### `calendar_events`

- `id`
- `family_id`
- `series_id` nullable
- `title`
- `description`
- `location`
- `start_at`
- `end_at`
- `all_day`
- `created_by_user_id`
- `updated_by_user_id`
- `version`

#### `calendar_event_profiles`

- `event_id`
- `profile_id`

#### `meal_plans`

- `id`
- `family_id`
- `meal_date`
- `meal_slot`
- `title`
- `description`
- `owner_profile_id` nullable
- `source_request_id` nullable
- `version`

#### `meal_requests`

- `id`
- `family_id`
- `requester_profile_id`
- `requested_for_date` nullable
- `title`
- `notes`
- `status`
- `assignee_profile_id` nullable
- `created_at`

#### `shopping_lists`

- `id`
- `family_id`
- `name`
- `is_default`

#### `shopping_categories`

- `id`
- `family_id` nullable for system defaults
- `name`
- `sort_order`

#### `shopping_items`

- `id`
- `family_id`
- `list_id`
- `category_id`
- `label`
- `quantity_text`
- `added_by_profile_id`
- `completed_by_profile_id` nullable
- `completed_at` nullable
- `archived_at` nullable
- `sort_order`
- `version`

### Relationships

- All domain records are scoped by `family_id`
- Profiles belong to exactly one family
- Events can be assigned to multiple profiles
- Meal requests belong to one family and can resolve into a meal plan
- Shopping items belong to one family list and one family

Current committed state:

- Family scoping is implemented consistently through `family_id`
- Current calendar events support a single optional assigned profile, not multiple profile assignments
- Shopping items are scoped directly to a family and do not yet use shopping lists or categories as separate tables

### Multi-User Data Isolation

- Scope every domain query through verified family membership
- Never trust the route `familyId` alone
- Every handler must enforce membership and role checks

### Calendar Query Strategy

- Query by date overlap, not just exact start date
- Convert family-local week boundaries to UTC server-side
- Materialize recurring event instances ahead of time instead of expanding every request dynamically
- Return a weekly read model tailored for the UI

Current committed state:

- A weekly read model endpoint is implemented
- Current queries use a simple start-time-in-week window in UTC
- Weekly recurring event materialization is implemented through `calendar_event_series` plus materialized `calendar_events`
- Family-timezone week conversion is not implemented yet

### Indexing Strategy

- `family_memberships`: unique `(family_id, user_id)`
- `profiles`: `(family_id, is_active)`
- `calendar_events`: `(family_id, start_at)`
- `calendar_events`: `(family_id, end_at)`
- `calendar_events`: GiST range index on `tstzrange(start_at, end_at, '[)')`
- `calendar_event_profiles`: `(profile_id, event_id)` and `(event_id, profile_id)`
- `meal_plans`: unique `(family_id, meal_date, meal_slot)`
- `meal_requests`: `(family_id, status, created_at desc)`
- `shopping_items`: `(family_id, list_id, completed_at, sort_order)`
- `shopping_items`: partial index for active items where `completed_at is null`
- `shopping_items`: `(family_id, category_id, completed_at)`
- `refresh_tokens`: `(user_id, expires_at)`

### Concurrency Strategy

- Add `version` columns or ETag support for mutable collaborative entities
- Require the version on update/delete requests
- Return `409 Conflict` on stale writes

---

## 5. Infrastructure and DevOps

### Deployment Topology

- Frontend deployed as static assets to Google Pages
- Backend deployed to a single-node K3s cluster in namespace `brightroom`
- PostgreSQL can be a single small instance for MVP, hosted in the simplest operationally safe way available to the team
- Run background work inside the API process

Current committed state:

- This remains target deployment intent; no committed deployment manifests or automation implement it yet

### K3s Setup Overview

This plan is tailored to a single-node K3s environment:

- Use standard Kubernetes manifests only: `Deployment`, `Service`, `Ingress`, `ConfigMap`, `Secret`, `Job`
- Do not design for node spreading, pod anti-affinity, horizontal autoscaling, or multi-zone behavior
- Keep the deployment small and operationally simple
- Assume the cluster already has an ingress controller available; attach the API through the existing ingress setup in `brightroom`
- Do not rely on cloud load balancer features

Required resources:

- `Deployment/planner-api`
- `Service/planner-api` as `ClusterIP`
- ingress host/path rule attached to the existing ingress in `brightroom`
- `ConfigMap/planner-api-config`
- `Secret/planner-api-secrets`
- `Job/planner-db-migrate`

### Kubernetes Runtime Settings

- 1 API replica for MVP to keep deployment and in-process scheduled work simple
- readiness probe on `/health/ready`
- liveness probe on `/health/live`
- resource requests and limits from the first deployment
- rolling update strategy
- WebSocket support at ingress is not required initially

Additional K3s-specific guidance:

- Keep CPU and memory requests conservative because API and system components share a single node
- Do not add `HorizontalPodAutoscaler`, `PodDisruptionBudget`, `topologySpreadConstraints`, or anti-affinity rules for MVP
- Prefer simple `RollingUpdate` settings that avoid downtime but do not assume spare cluster capacity
- If PostgreSQL is ever moved into K3s, use storage only if the team is already comfortable with single-node persistence tradeoffs

### CI/CD Pipeline

GitHub Actions pipeline stages:

1. Install dependencies and restore caches
2. Lint, typecheck, and test frontend
3. Restore, build, and test backend
4. Run integration tests with PostgreSQL using Testcontainers
5. Build frontend artifact
6. Build and push backend container image
7. Run database migration job in target environment using generated EF Core migrations
8. Deploy API to Kubernetes
9. Deploy frontend static assets

Current committed state:

- No GitHub Actions workflows are committed yet

K3s deployment note:

- Keep deployment scripts compatible with standard `kubectl apply` against the K3s cluster
- Avoid introducing Helm unless it reduces actual maintenance overhead for this small app

### Environment Configuration

- `dev`: local development
- `prod`: live environment

Rules:

- Promote the same artifact where practical
- Inject configuration at deploy time
- Expose only non-sensitive frontend variables via `VITE_PUBLIC_*`

### Secrets Management

- Use GitHub Secrets for sensitive values
- Use GitHub Variables for non-sensitive deploy configuration
- Inject secrets into Kubernetes Secrets during deployment
- Never commit secrets to source control

### Monitoring and Logging

Per project requirement:

- Do not include a monitoring stack
- Log fatal and unhandled server errors to console in structured JSON

### Single-Node Operational Notes

- The API is a single point of runtime execution in MVP, which is acceptable for this small private deployment
- In-process background work must stay lightweight so it does not contend with request handling on the same node
- Backups are more important than cluster-level redundancy at this stage
- Recovery should prioritize simple redeploy + restore procedures over high-availability design

---

## 6. Security Best Practices

### Authentication and Session Handling

- Use short-lived JWT access tokens
- Use rotating refresh tokens
- Store refresh tokens in secure `HttpOnly` cookies
- Keep access tokens in memory only
- Revoke refresh tokens on logout, password change, and suspicious session events

Current committed state:

- JWT access tokens are implemented
- Refresh tokens and cookie-backed session handling are not implemented yet
- The frontend currently persists the access token in `localStorage`

### Secure API Design

- Enforce authorization on every family-scoped endpoint
- Use policy-based authorization for family roles
- Return generic auth failures to avoid resource and account enumeration

### HTTPS Enforcement

- Enforce HTTPS at ingress
- Redirect HTTP to HTTPS
- Enable HSTS on API responses

### CORS Policy

- Allow only exact frontend origins for development and production
- Never use `AllowAnyOrigin` with credentials

### Input Validation and Sanitization

- Validate all command/query payloads with FluentValidation
- Validate client payloads with Zod for immediate UX feedback
- Reject or sanitize HTML input because rich text is unnecessary

Current committed state:

- Validation is currently lightweight and inline
- No shared sanitization or formal validation pipeline is committed yet

### Protection Against XSS

- Use React default escaping
- Avoid `dangerouslySetInnerHTML`
- Add a Content Security Policy

Current committed state:

- React default escaping is in effect and no `dangerouslySetInnerHTML` usage is committed in the core app
- CSP headers are not implemented yet

### Protection Against CSRF

- Because refresh tokens are cookie-based, protect refresh/logout-style endpoints with CSRF defenses
- Use `SameSite`, CSRF tokens, and strict origin validation as appropriate

Current committed state:

- Not yet applicable in committed code because refresh-cookie flows are not implemented

### Protection Against Injection Attacks

- Use EF Core or parameterized SQL only
- Never concatenate raw SQL with user input

### Rate Limiting

Suggested server-side limits:

- login: `5/min/IP`
- refresh: `30/min/user`
- standard API traffic: `300/min/user`
- stricter limits for mutation bursts if needed

Current committed state:

- Rate limiting is not implemented yet

### Secure Storage of Secrets

- GitHub Secrets for CI/CD
- Kubernetes Secrets for runtime
- Rotate secrets regularly

---

## 7. Accessibility (WCAG 2.1 AA)

### Accessibility Principles

- Profile colors must never be the only signal
- Every color-coded state must include text, avatar, icon, or initials
- All controls must maintain a minimum 48px touch target
- Contrast ratio must meet WCAG 2.1 AA thresholds

### Required Frontend Guidelines

- Use semantic headings and landmark regions
- Ensure keyboard navigation works across the entire app
- Provide visible focus states
- Ensure icon-only controls have accessible names
- Use list semantics for agenda and shopping list content
- Associate error text with form fields via ARIA
- Use `aria-live="polite"` for sync, offline, and mutation result messaging
- Trap focus in dialogs and bottom sheets and restore focus on close
- Respect `prefers-reduced-motion`

### Color Contrast Considerations

- Restrict profile colors to an approved accessible palette in MVP
- Show contrast warnings during profile color selection
- Use accent chips and borders when solid color backgrounds would reduce readability

### Screen Reader Support

- Label all buttons, toggles, and navigation items
- Announce sheet open/close states clearly
- Provide meaningful alt text only where images convey useful information
- Avoid redundant decorative announcements

### ARIA Usage

- Use ARIA only where semantic HTML is insufficient
- Examples include dialogs, live regions, sheet triggers, and validation relationships

### Accessibility Validation

- Automated checks with `axe`
- Component-level accessibility tests for shared primitives
- Manual keyboard and screen reader testing before release

Current committed state:

- Accessibility guidance is useful product direction, but automated accessibility tooling and dedicated tests are not committed yet

---

## 8. GDPR and Cookie Consent

### Cookie Consent Scope

MVP cookie categories:

- Essential only

Current committed state:

- No consent banner, consent persistence, or legal pages are committed yet
- The current app uses `localStorage` for session persistence, which differs from the planned cookie-only MVP description

Examples of essential cookies:

- refresh/session cookies
- CSRF-related cookie if used

### Banner Behavior

- Show on first visit
- Explain that only essential cookies are used for sign-in, security, and session continuity
- Provide:
  - `Acknowledge`
  - `Read Privacy Notice`
- No opt-out for essential cookies because the authenticated product requires them

### Opt-In and Opt-Out Handling

- No optional cookie categories in MVP
- If optional cookies are ever introduced, require explicit opt-in and preference storage

### Data Privacy Considerations

- Collect only necessary personal data
- Separate login identity from family profile data
- Support user account deletion
- Support family profile deletion by authorized admins
- Support full family deletion workflow
- Anonymize authorship only where hard delete would break shared records

### Right to Delete Data

- Implement account deletion request path
- Implement family deletion path for admins
- Run destructive cleanup through background jobs to guarantee completion and auditability

### Suggested Implementation Approach

- Frontend: lightweight custom banner in `features/consent`
- Backend: `user_consents` table to track policy version acknowledgements where necessary
- Legal content: static privacy, cookie, and terms pages

Current committed state:

- None of the consent implementation pieces are committed yet

---

## 9. Feature Breakdown and Delivery Plan

### MVP Scope

- Authentication and family bootstrap
- Family profile management
- Home dashboard
- Weekly calendar
- Weekly meals planner
- Meal requests
- Shared shopping list
- Essential offline read support
- Core accessibility and security hardening
- Essential cookie disclosure

### Full Feature Set Beyond MVP

- Multi-family switching
- Advanced recurring events
- Real-time collaboration beyond shopping and meal requests
- Invite-based onboarding for additional adults
- Push notifications
- Advanced offline conflict resolution
- Data export tooling

### Phase 1: Foundation

- [x] Create the monorepo structure
- [x] Initialize `apps/web`, `apps/api`, and shared packages
- [ ] Extract Kinship UI tokens into a reusable token package
- [x] Set up React app shell, routing, and provider composition
- [x] Set up ASP.NET Core solution and project boundaries
- [x] Configure PostgreSQL and EF Core migrations
- [x] Document the `dotnet ef` workflow for creating and applying migrations
- [ ] Implement auth, refresh flow, and membership model
- [x] Add local development tooling
- [ ] Configure CI/CD baseline
- [ ] Add Kubernetes manifests and environment templates

Completed in current implementation pass:

- Monorepo scaffold created with `apps`, `packages`, `infra`, and supporting docs folders
- Root workspace files added: `package.json`, `pnpm-workspace.yaml`, `.editorconfig`, `justfile`, `planner.sln`
- ASP.NET Core API, class libraries, and test projects created and wired into the solution
- Vite React TypeScript app created under `apps/web`
- React app shell, protected routing, provider composition, and bottom navigation added under `apps/web/src/app`
- Initial persistence layer added with `PlannerDbContext`, first entities, and first generated EF Core migration
- Local `dotnet-ef` tool manifest added and aligned to EF Core 9
- JWT auth, login/register, family membership bootstrap, and the first protected frontend session flow are implemented

Still intentionally incomplete in Phase 1:

- Refresh-token cookie flow is not implemented yet; the frontend currently stores session data in `localStorage`
- `packages/design-tokens` and `packages/api-client` exist, but are still placeholders
- `infra/k8s` and `infra/github` currently contain placeholders rather than real manifests or workflows

### Phase 2: Core Features

- [x] Build profile management flows
- [x] Build calendar weekly read model and CRUD
- [x] Build meals planner weekly read model and CRUD
- [x] Build meal request flow
- [x] Build shopping list quick add and toggle flows
- [x] Build dashboard aggregation endpoint and page
- [x] Implement optimistic updates for core interactions
- [x] Generate typed API client from OpenAPI
- [x] Add baseline test coverage for all core flows

Completed in current implementation pass:

- Profile management is wired end to end with profile list, create, and update flows
- Calendar weekly read model and create/update flows are implemented
- Meals weekly planner and meal request flows are implemented
- Shopping list read, quick add, and toggle flows are implemented
- Home dashboard overview endpoint and page are implemented with weekly snapshot, today's plan, dinner tonight, shopping summary, and upcoming event cards
- Baseline API tests now cover register/bootstrap, dashboard aggregation, and meal request acceptance flow against an in-memory test host
- Core query hooks now apply optimistic cache updates for profile, shopping, calendar, meal, and meal request mutations
- A generated TypeScript API client now lives in `packages/api-client` and the web app wrappers consume it

Still intentionally incomplete in Phase 2:

- Test coverage is now baseline rather than placeholder-only, but it is still narrow and should expand with each feature slice

### Phase 3: Enhancements

- [x] Add IndexedDB caching and offline read support
- [x] Add offline mutation queue for selected flows
- [x] Add recurring event support with materialization jobs
- [x] Add invite flows for additional users
- [ ] Add deletion and privacy workflows
- [ ] Expand accessibility testing and polish
- [ ] Evaluate whether lightweight polling is needed on collaborative screens

Completed in current implementation pass:

- Protected read models now fall back to IndexedDB-backed cached data for bootstrap, dashboard, calendar, meals, meal requests, and shopping
- The app shell shows a lightweight offline banner when the browser is offline
- Shopping, calendar, and meal mutations now queue in IndexedDB and flush when the browser reconnects
- Calendar now supports weekly recurring events backed by `calendar_event_series`, with an in-process materializer filling future occurrences
- The calendar page exposes weekly repeat creation and future-series update behavior for recurring events
- Family admins can now create email-based invite links and review invite status from the Family page
- The `/invite/:token` route now supports invite acceptance into an existing family with account creation and immediate sign-in

### Phase 4: Optimization

- [ ] Add lightweight Lighthouse checks for mobile performance and PWA quality
- [ ] Improve offline conflict handling
- [ ] Tune database indexes using real query plans
- [ ] Tighten rate limits and security headers
- [ ] Strengthen deploy rollback and migration safety
- [ ] Finalize production release checklist

---

## 10. Developer Experience

### Recommended Project Structure

- Keep all application code under `apps`
- Keep cross-cutting TypeScript packages under `packages`
- Keep infra manifests under `infra`
- Keep product and architecture documentation under `docs`

### Local Development Setup

- `pnpm install`
- `dotnet restore`
- local PostgreSQL via Docker Compose
- run web and API independently with hot reload
- use local environment files for public frontend config
- use .NET user-secrets or local environment variables for backend secrets

### Tooling

- Frontend linting: ESLint
- Frontend formatting: Prettier
- Backend formatting: `dotnet format`
- Shared config: `.editorconfig`
- Frontend tests: Vitest + React Testing Library
- Backend tests: xUnit + FluentAssertions
- Integration tests: Testcontainers with PostgreSQL
- End-to-end tests: Playwright

### Documentation Approach

- Root `README.md` for setup and common commands
- `docs/architecture` for ADRs and diagrams
- `docs/runbooks` for deploy, rollback, and migration operations
- `docs/api` for generated API docs
- `docs/testing` for test strategy and local workflows

### Recommended ADRs

- REST over GraphQL
- Vertical Slice Architecture with Clean boundaries
- TanStack Query + Zustand split
- PostgreSQL recurrence materialization strategy
- Refresh-token cookie and in-memory access-token model
- Offline support scope for MVP

---

## Key Decisions Summary

- Database: PostgreSQL
- Backend style: Vertical Slice Architecture with API/Application/Domain/Infrastructure separation
- API style: REST with screen-optimized read models
- Frontend state: TanStack Query + Zustand
- Styling: Tailwind CSS + shared design tokens
- Real-time: start with optimistic UI and revalidation only
- Background jobs: run in-process inside the API container for MVP
- Offline: cache reads first, then add selective offline mutation support
- Authentication: ASP.NET Core Identity + JWT access tokens + rotating refresh tokens

---

## Assumptions

- The Google Pages target supports static SPA deployment
- MVP usage is limited to a small number of families and modest traffic
- Push notifications are not required for MVP
- Child family members can exist only as profiles without user accounts
- The existing ingress in namespace `brightroom` can be extended for the API host/path
- The target cluster is a single-node K3s instance

---

## Working Agreement for Next Steps

Use this document as the implementation baseline.

Best next steps:

1. Reshape `apps/web` from the default Vite starter into the planned app shell and FSA folder structure
2. Add backend configuration for auth, family bootstrap, and the first real API feature slice
3. Add a migration runbook under `docs/runbooks` using the repo-local `dotnet dotnet-ef` workflow
4. Add initial K3s manifests and a minimal GitHub Actions pipeline for build and migration execution
4. Start Phase 1 foundation work
