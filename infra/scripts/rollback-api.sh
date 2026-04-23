#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 0 || $# -gt 3 ]]; then
  printf 'Usage: %s [deployment] [namespace] [revision]\n' "$0" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  printf 'kubectl is required.\n' >&2
  exit 1
fi

deployment="${1:-planner-api}"
namespace="${2:-brightroom}"
revision="${3:-}"

if [[ -n "$revision" ]]; then
  kubectl -n "$namespace" rollout undo "deployment/$deployment" --to-revision="$revision"
else
  kubectl -n "$namespace" rollout undo "deployment/$deployment"
fi

kubectl -n "$namespace" rollout status "deployment/$deployment" --timeout=180s

printf 'Rollback completed successfully.\n'
