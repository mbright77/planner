#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${ConnectionStrings__Planner:-}" ]]; then
  printf 'Set ConnectionStrings__Planner before running migrations.\n' >&2
  exit 1
fi

dotnet_ef_args=()

if [[ -n "${DOTNET_EF_MSBUILD_PROJECT_EXTENSIONS_PATH:-}" ]]; then
  dotnet_ef_args+=(--msbuildprojectextensionspath "$DOTNET_EF_MSBUILD_PROJECT_EXTENSIONS_PATH")
fi

dotnet tool restore
dotnet dotnet-ef database update \
  "${dotnet_ef_args[@]}" \
  --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj \
  --startup-project apps/api/src/Planner.Api/Planner.Api.csproj

printf 'Database migrations applied successfully.\n'
