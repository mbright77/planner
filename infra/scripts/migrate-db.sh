#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${ConnectionStrings__Planner:-}" ]]; then
  printf 'Set ConnectionStrings__Planner before running migrations.\n' >&2
  exit 1
fi

dotnet tool restore
dotnet dotnet-ef database update \
  --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj \
  --startup-project apps/api/src/Planner.Api/Planner.Api.csproj

printf 'Database migrations applied successfully.\n'
