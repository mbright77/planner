#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 || $# -gt 4 ]]; then
  printf 'Usage: %s <image> [deployment] [container] [namespace]\n' "$0" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  printf 'kubectl is required.\n' >&2
  exit 1
fi

image="$1"
deployment="${2:-planner-api}"
container="${3:-planner-api}"
namespace="${4:-brightroom}"

current_image="$(kubectl -n "$namespace" get deployment "$deployment" -o jsonpath="{.spec.template.spec.containers[?(@.name=='$container')].image}")"

if [[ -z "$current_image" ]]; then
  printf 'Unable to determine the current image for %s/%s.\n' "$deployment" "$container" >&2
  exit 1
fi

printf 'Updating %s/%s in namespace %s\n' "$deployment" "$container" "$namespace"
printf 'Previous image: %s\n' "$current_image"
printf 'Next image: %s\n' "$image"

kubectl -n "$namespace" set image "deployment/$deployment" "$container=$image"

if ! kubectl -n "$namespace" rollout status "deployment/$deployment" --timeout=180s; then
  printf 'Rollout failed. Reverting deployment %s in namespace %s.\n' "$deployment" "$namespace" >&2
  kubectl -n "$namespace" rollout undo "deployment/$deployment"
  kubectl -n "$namespace" rollout status "deployment/$deployment" --timeout=180s
  exit 1
fi

printf 'Rollout completed successfully.\n'
