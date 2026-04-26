# Deployment

## Overview

- Frontend deploys to GitHub Pages.
- Backend deploys to the single-node K3s cluster in namespace `brightroom`.
- Backend deployment follows the same pattern used in `/home/michael/Dev/allergen-info`:
  - build and test in GitHub Actions
  - build and push a backend image to GHCR
  - package a backend deploy bundle
  - copy the bundle to the VPS with `scp`
  - run a remote deployment script over SSH
- nginx is managed outside this repository.
- The ingress resource is managed in the BrightRoom repository, not in this repository.

## Production URLs

- GitHub repository: `mbright77/planner`
- GitHub Pages origin: `https://mbright77.github.io`
- GitHub Pages app base path: `/planner/`
- GitHub Pages app URL: `https://mbright77.github.io/planner/`
- Backend public URL: `https://hub.brightmatter.net/planner-api`
- Backend public path base: `/planner-api`

## Deployment Topology

- Frontend:
  - Vite static build from `apps/web`
  - deployed to GitHub Pages as a static artifact
- Backend:
  - ASP.NET Core API from `apps/api`
  - containerized and published to GHCR
  - deployed to K3s as `Deployment/planner-api` and `Service/planner-api`
- Database:
  - reuse the existing PostgreSQL service already running in `brightroom`
  - do not add a second PostgreSQL deployment for planner
  - do not expose a PostgreSQL port from the planner API deployment

## PostgreSQL

- PostgreSQL service host: `postgres`
- PostgreSQL service port: `5432`
- Production database name: `planner`
- Recommended application user: `planner_app`
- Production connection string shape:

```text
Host=postgres;Port=5432;Database=planner;Username=planner_app;Password=...
```

- The `5433:5432` mapping in local Docker Compose is only for local development.
- No additional PostgreSQL port is required in the planner deployment.
- The planner API only needs to expose HTTP on port `8080`.

## Kubernetes Runtime Shape

- Namespace: `brightroom`
- Deployment name: `planner-api`
- Service name: `planner-api`
- ConfigMap name: `planner-api-config`
- Secret name: `planner-api-secrets`
- GHCR image pull secret name: `ghcr-pull-secret`
- Service type: `ClusterIP`
- Container name: `api`
- Container port: `8080`
- Replica count: `1`
- Image registry: `ghcr.io`

## Ingress Model

- The planner backend should use the same path-stripped ingress model as `safescan-api`.
- The BrightRoom repository should manage an ingress rule equivalent to:

```yaml
- path: /planner-api(/|$)(.*)
  pathType: ImplementationSpecific
  backend:
    service:
      name: planner-api
      port:
        number: 8080
```

- The BrightRoom ingress should use the same rewrite annotations used by `safescan-api`:

```yaml
nginx.ingress.kubernetes.io/rewrite-target: /$2
nginx.ingress.kubernetes.io/use-regex: "true"
```

- The backend should run with `PathBase=/planner-api`.

## Health Probes

- Readiness probe path: `/planner-api/health/ready`
- Liveness probe path: `/planner-api/health/live`

These paths match the path-base deployment model used by `safescan-api`.

## Frontend GitHub Actions Workflow

- Workflow file: `.github/workflows/deploy-frontend-pages.yml`
- Trigger:
  - `push` to `main`
  - `workflow_dispatch`
- Path filters:
  - `apps/web/**`
  - `packages/api-client/**`
  - `package.json`
  - `pnpm-lock.yaml`
  - `pnpm-workspace.yaml`
  - `.github/workflows/deploy-frontend-pages.yml`
- Main steps:
  - checkout repository
  - set up Node.js
  - set up pnpm
  - install dependencies
  - run `pnpm --filter @planner/web test`
  - build frontend with production variables
  - configure GitHub Pages
  - upload `apps/web/dist`
  - deploy GitHub Pages artifact

## Backend GitHub Actions Workflow

- Workflow file: `.github/workflows/deploy-backend-k3s.yml`
- Trigger:
  - `push` to `main`
  - `workflow_dispatch`
- Path filters:
  - `apps/api/**`
  - `deploy/backend/**`
  - `infra/**`
  - `planner.sln`
  - `package.json`
  - `pnpm-lock.yaml`
  - `.github/workflows/deploy-backend-k3s.yml`
- Main steps:
  - checkout repository
  - set up .NET 9
  - build `planner.sln`
  - test `planner.sln`
  - log in to GHCR
  - build and push backend image
  - package backend deploy bundle
  - copy deploy bundle to VPS with `scp`
  - run remote deployment script with `ssh`

## Backend Deploy Bundle

- Recommended bundle directory: `deploy/backend`
- Recommended remote script path: `deploy/backend/deploy.sh`
- The remote deploy script should:
  - unpack the bundle on the VPS
  - ensure namespace `brightroom` exists
  - ensure GHCR pull secret exists when required
  - create or update `planner-api-config`
  - create or update `planner-api-secrets`
  - apply `Deployment/planner-api`
  - apply `Service/planner-api`
  - wait for rollout completion
  - print deployment, pod, and event status

## Backend Container

- Recommended Dockerfile path: `apps/api/Dockerfile`
- Container requirements:
  - multi-stage .NET 9 build
  - publish `Planner.Api`
  - expose port `8080`
  - set `ASPNETCORE_URLS=http://+:8080`

## Frontend Build Variables

Use GitHub Actions variables for non-sensitive frontend deployment settings.

- `RUN_DEPLOY=true`
- `FRONTEND_API_BASE_URL=https://hub.brightmatter.net/planner-api`
- `FRONTEND_APP_BASE_PATH=/planner/`

The frontend build should receive:

```text
VITE_API_BASE_URL=https://hub.brightmatter.net/planner-api
VITE_APP_BASE_PATH=/planner/
```

## Backend GitHub Actions Variables

Use GitHub Actions variables for non-sensitive backend deployment settings.

- `RUN_DEPLOY=true`
- `VPS_HOST`
- `VPS_USER`
- `VPS_PORT`
- `K8S_NAMESPACE=brightroom`
- `K8S_DEPLOYMENT_NAME=planner-api`
- `K8S_SERVICE_NAME=planner-api`
- `GHCR_IMAGE_PULL_SECRET_NAME=ghcr-pull-secret`
- `ASPNETCORE_ENVIRONMENT=Production`
- `BACKEND_PATH_BASE=/planner-api`
- `ALLOWED_ORIGINS=https://mbright77.github.io`
- `JWT_ISSUER=planner-api`
- `JWT_AUDIENCE=planner-web`

## Backend GitHub Actions Secrets

Use GitHub Actions secrets for sensitive values.

- `VPS_SSH_PRIVATE_KEY`
- `GHCR_USERNAME`
- `GHCR_TOKEN`
- `GHCR_EMAIL`
- `PLANNER_CONNECTION_STRING`
- `PLANNER_JWT_SIGNING_KEY`




## Kubernetes ConfigMap Keys

Recommended non-sensitive runtime keys for `planner-api-config`:

- `ASPNETCORE_ENVIRONMENT`
- `PathBase`
- `AllowedOrigins`
- `Jwt__Issuer`
- `Jwt__Audience`

## Kubernetes Secret Keys

Recommended sensitive runtime keys for `planner-api-secrets`:

- `ConnectionStrings__Planner`
- `Jwt__SigningKey`

## Runtime Values

The backend runtime should be configured with:

```text
ASPNETCORE_ENVIRONMENT=Production
PathBase=/planner-api
AllowedOrigins=https://mbright77.github.io
Jwt__Issuer=planner-api
Jwt__Audience=planner-web
ConnectionStrings__Planner=Host=postgres;Port=5432;Database=planner;Username=planner_app;Password=...
Jwt__SigningKey=<secret>
```

## Manual First Migration

The first production migration remains manual.

1. Create the `planner` database.
2. Create the `planner_app` PostgreSQL user.
3. Grant the required privileges.
4. Run the migration manually before the first production rollout:

```bash
ConnectionStrings__Planner="Host=postgres;Port=5432;Database=planner;Username=planner_app;Password=..." \
  infra/scripts/migrate-db.sh
```

## Pre-Deployment Application Changes

These items are the required production-enablement changes for this repository.

- Frontend:
  - support `VITE_APP_BASE_PATH`
  - use a matching router `basename`
  - add GitHub Pages SPA fallback handling for deep links
- Backend:
  - replace localhost-only CORS with configurable origins
  - support forwarded headers for nginx and ingress
  - support configurable `PathBase`
- Infrastructure:
  - add backend Dockerfile
  - add GitHub Actions workflows
  - add backend deploy bundle and remote deploy script
  - add committed deployment configuration for `planner-api`

Current repository state:

- The frontend now supports the GitHub Pages repo path through Vite `base`, router `basename`, and a Pages fallback file.
- The backend now supports configurable CORS origins, forwarded headers, and configurable `PathBase`.
- The backend Dockerfile, backend deploy bundle, GitHub Actions workflows, and committed `planner-api` deployment assets are now present in the repository.
- External prerequisites still remain before the first live rollout:
  - provision the `planner` database and `planner_app` credentials in the existing PostgreSQL server
  - apply the first production migration manually
  - add the `/planner-api` ingress rule in the BrightRoom repository

## Rollout Order

1. Add frontend GitHub Pages base-path and SPA fallback support.
2. Add backend production configuration support for CORS, forwarded headers, and path base.
3. Add backend Dockerfile.
4. Add backend deploy bundle and backend workflow.
5. Add frontend Pages workflow.
6. Provision the production database and credentials in the existing PostgreSQL server.
7. Add the `/planner-api` ingress route in the BrightRoom repository.
8. Run the first backend deployment.
9. Run the first production migration manually.
10. Run the frontend deployment.

## Verification

- Frontend:
  - load `https://mbright77.github.io/planner/`
  - verify direct route loads work under the Pages repo path
- Backend:
  - verify `https://hub.brightmatter.net/planner-api/health/live`
  - verify `https://hub.brightmatter.net/planner-api/health/ready`
- End-to-end:
  - sign in with a real test account
  - load Home, Shopping, Calendar, Meals, and Family pages
  - confirm one authenticated mutation succeeds

## Ownership Notes

- This repository owns frontend Pages deployment, backend image build, backend deploy automation, and planner-specific runtime configuration.
- The BrightRoom repository owns the ingress resource that exposes `/planner-api`.
- nginx remains managed outside this repository.
