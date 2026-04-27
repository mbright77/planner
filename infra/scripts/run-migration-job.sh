#!/usr/bin/env bash

set -euo pipefail

NS=${1:-brightroom}
JOB_MANIFEST="infra/k8s/planner-api/job-migrate.yaml"

if [[ ! -f "$JOB_MANIFEST" ]]; then
  echo "Missing job manifest: $JOB_MANIFEST" >&2
  exit 1
fi

echo "Applying migration Job to namespace: $NS"
kubectl apply -f "$JOB_MANIFEST"

echo "Tailing logs (ctrl-C to stop). This will show the pod logs for the job until it finishes."
# Wait for a pod to be created for the job
pod=""
for i in $(seq 1 30); do
  pod=$(kubectl -n "$NS" get pods --selector=job-name=planner-db-migrate -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [[ -n "$pod" ]]; then break; fi
  sleep 1
done

if [[ -z "$pod" ]]; then
  echo "Timed out waiting for job pod to appear" >&2
  kubectl -n "$NS" get jobs
  exit 1
fi

kubectl -n "$NS" logs -f "$pod"

echo "Job finished. To clean up the Job resource run: kubectl -n $NS delete job planner-db-migrate --wait=false" 
