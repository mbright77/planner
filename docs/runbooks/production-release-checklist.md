# Production Release Checklist

## Purpose

Use this checklist before every production release of the Family Planner MVP.

## 1. Verify The Branch

- Confirm the branch contains the intended commits only.
- Confirm `IMPLEMENTATION_PLAN.md` reflects the delivered work.
- Confirm generated assets and migrations are committed.

## 2. Run Local Verification

Frontend:

```bash
pnpm --filter @planner/web test
pnpm --filter @planner/web build
pnpm --filter @planner/web lighthouse:mobile
```

Backend:

```bash
dotnet build planner.sln
dotnet test planner.sln
```

If schema changed:

```bash
dotnet tool restore
dotnet dotnet-ef migrations list \
  --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj \
  --startup-project apps/api/src/Planner.Api/Planner.Api.csproj
```

## 3. Review Release Risk

- Confirm whether the release includes a database migration.
- Confirm whether the release changes authentication, offline sync, or background worker behavior.
- Confirm whether any known issue requires an operator note for rollout.

## 4. Prepare Production Inputs

- Confirm the API image tag to deploy.
- Confirm the target namespace and deployment/container names.
- Confirm the exact production database connection string is available.
- Confirm a fresh database backup or snapshot exists before migration.

## 5. Apply Database Migrations

```bash
ConnectionStrings__Planner="Host=<host>;Port=<port>;Database=<db>;Username=<user>;Password=<password>" \
  infra/scripts/migrate-db.sh
```

Stop the release here if migration fails.

## 6. Roll Out The API

```bash
infra/scripts/deploy-api.sh <image> [deployment] [container] [namespace]
```

If rollout fails, the script automatically attempts `kubectl rollout undo`.

## 7. Verify Production Health

- Check `GET /health/live`.
- Check `GET /health/ready`.
- Sign in with a real test account.
- Load Home, Shopping, Calendar, Meals, and Family pages.
- Confirm one protected mutation succeeds.

## 8. Roll Back If Needed

If the new API image is unhealthy after rollout:

```bash
infra/scripts/rollback-api.sh [deployment] [namespace]
```

If a specific prior revision is required:

```bash
infra/scripts/rollback-api.sh [deployment] [namespace] <revision>
```

## 9. Post-Release Notes

- Record the deployed image tag.
- Record the applied migration name, if any.
- Record any rollback, incident, or follow-up action.

## Current Limits

- This repo still does not contain committed CI deployment workflows or Kubernetes manifests.
- Database rollback is still operator-driven; prefer backup/restore or forward-fix decisions over ad hoc reversal.
- A known recurring-event migration issue should be resolved before relying on full Postgres migration-chain verification in production-like environments.
