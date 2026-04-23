# Deploy And Rollback

## Purpose

Use these steps to update the API deployment while keeping rollback fast and explicit.

## Preconditions

- `kubectl` points at the correct K3s cluster.
- The target deployment already exists.
- The API image has been built and published.
- Database migrations, if needed, have already been applied successfully.

## Safe Rollout

```bash
infra/scripts/deploy-api.sh <image> [deployment] [container] [namespace]
```

Defaults:

- deployment: `planner-api`
- container: `planner-api`
- namespace: `brightroom`

What the script does:

- reads the current deployment image
- updates the deployment to the requested image
- waits for rollout completion
- automatically runs `kubectl rollout undo` if the rollout fails

## Manual Rollback

Roll back to the previous revision:

```bash
infra/scripts/rollback-api.sh [deployment] [namespace]
```

Roll back to a specific revision:

```bash
infra/scripts/rollback-api.sh [deployment] [namespace] <revision>
```

Helpful inspection commands:

```bash
kubectl -n brightroom rollout history deployment/planner-api
kubectl -n brightroom get pods
kubectl -n brightroom logs deployment/planner-api --tail=200
```

## Release Order

1. Apply database migrations.
2. Roll out the new API image.
3. Verify `/health/ready` and a protected API path.
4. If verification fails, roll back the deployment immediately.

## Current Limits

- This repo still does not contain committed Kubernetes manifests or CI deployment workflows.
- Rollback currently covers the API deployment image only; database rollback still requires operator judgment.
