# Migration Safety

## Purpose

Apply EF Core migrations with an explicit target connection string and a clear recovery path.

## Rules

- Never hand-edit migration files.
- Always generate migrations with repo-local `dotnet-ef`.
- Never run production-style migrations against an implicit default database.
- Apply schema changes before rolling out app code that depends on them.

## Generate A Migration

```bash
dotnet tool restore
dotnet dotnet-ef migrations add <MeaningfulName> \
  --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj \
  --startup-project apps/api/src/Planner.Api/Planner.Api.csproj \
  --output-dir Persistence/Migrations
```

## Apply Migrations Safely

Set the target connection string explicitly, then run:

```bash
ConnectionStrings__Planner="Host=<host>;Port=<port>;Database=<db>;Username=<user>;Password=<password>" \
  infra/scripts/migrate-db.sh
```

Why this wrapper exists:

- the design-time factory otherwise falls back to the default `planner` database
- explicit connection strings reduce accidental writes to the wrong local or shared database

## Pre-Deploy Checks

1. Confirm the target database host, port, and name.
2. Confirm the migration list matches the branch being deployed.
3. Take a backup or snapshot before applying destructive schema changes.
4. Apply migrations before the API rollout.

## Recovery Notes

- If a migration fails before completion, stop the rollout and inspect the failed migration step.
- If the app deployment fails after a successful migration, roll back the deployment image first.
- Do not assume a database rollback is safe; prefer forward-fix migrations unless you have a verified restore point.

## Current Limits

- This repo does not yet include a committed Kubernetes migration job manifest.
- Full migration-chain verification against Postgres is currently blocked by an existing recurring-event migration issue that should be fixed separately.
