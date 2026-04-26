# Deployment Variables & Secrets

This file documents all deployment variables needed for the planner deployment. Use this as a reference when adding values to GitHub Actions secrets/variables and Kubernetes ConfigMap/Secret objects.

## Add These First (GitHub Actions Variables)

| Name | Value | Used Where | Description |
|------|-------|-----------|-------------|
| RUN_DEPLOY | `true` | Both workflows | Toggle to enable deployment steps. |
| FRONTEND_API_BASE_URL | `https://hub.brightmatter.net/planner-api` | Frontend build | Frontend calls this backend URL. |
| FRONTEND_APP_BASE_PATH | `/planner/` | Frontend build | GitHub Pages repo base path. |
| VPS_HOST | `vps.brightmatter.net` | Backend deploy | Host for scp/ssh deploy. |
| VPS_USER | `deploy` | Backend deploy | SSH user on VPS. |
| VPS_PORT | `22` (optional, defaults to 22) | Backend deploy | SSH port. |
| GHCR_IMAGE_PULL_SECRET_NAME | `ghcr-pull-secret` | Backend deploy | K8s imagePullSecret name. |
| ALLOWED_ORIGINS | `https://mbright77.github.io` | Backend deploy | CORS origins. |
| JWT_ISSUER | `planner-api` | Backend deploy | JWT issuer. |
| JWT_AUDIENCE | `planner-web` | Backend deploy | JWT audience. |

## Add These Second (GitHub Actions Secrets)

| Name | Value | Used Where | Description |
|------|-------|-----------|-------------|
| VPS_SSH_PRIVATE_KEY | `-----BEGIN OPENSSH PRIVATE KEY-----...` | Backend deploy | SSH private key for VPS access (sensitive — example). |
| GHCR_USERNAME | `mbright77` | Backend deploy | GHCR login username (sensitive — example). |
| GHCR_TOKEN | `ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | Backend deploy | GHCR token / personal access token (sensitive — example). |
| GHCR_EMAIL | `you@example.com` | Backend deploy | GHCR login email (sensitive — example). |
| PLANNER_CONNECTION_STRING | `Host=postgres;Port=5432;Database=planner;Username=planner_app;Password=supersecret` | Backend deploy | DB connection string (sensitive — example). |
| PLANNER_JWT_SIGNING_KEY | `base64-or-hex-32-byte-key` | Backend deploy | JWT signing key (sensitive — example). |

## Duplicates to Avoid

These names refer to the same values — use only one:

| Use This Name | Not This Name | Notes |
|--------------|---------------|-------|
| FRONTEND_API_BASE_URL | VITE_API_BASE_URL | VITE_... set from FRONTEND_... at build time |
| FRONTEND_APP_BASE_PATH | VITE_APP_BASE_PATH | VITE_... set from FRONTEND_... at build time |

These are hardcoded in deploy.sh and don't need to be set as variables:

| Name | Value | Notes |
|------|-------|-------|
| K8S_NAMESPACE | `brightroom` | Hardcoded in deploy.sh |
| K8S_DEPLOYMENT_NAME | `planner-api` | Hardcoded in deploy.sh |
| K8S_SERVICE_NAME | `planner-api` | Hardcoded in deploy.sh |
| ASPNETCORE_ENVIRONMENT | `Production` | Hardcoded in deploy.sh |
| BACKEND_PATH_BASE | `/planner-api` | Hardcoded in deploy.sh |

## Notes

- VITE_... variables are set at build time from FRONTEND_... variables.
- Kubernetes ConfigMap keys use double-underscore (`__`) for nesting (e.g., `Jwt__Issuer` maps to `Jwt:Issuer` in config).
- Keep secrets only in GitHub Actions secrets and Kubernetes Secret objects — never commit them.
- The deploy.sh script handles ConfigMap/Secret creation — no manual K8s config needed.
