# Planner

Family Planner PWA monorepo.

## Structure

```text
.
├─ apps/
│  ├─ api/
│  └─ web/
├─ packages/
│  ├─ api-client/
│  ├─ design-tokens/
│  ├─ eslint-config/
│  └─ tsconfig/
├─ infra/
│  ├─ github/
│  ├─ k8s/
│  └─ scripts/
├─ docs/
├─ IMPLEMENTATION_PLAN.md
├─ planner.sln
├─ package.json
├─ pnpm-workspace.yaml
└─ justfile
```

## Current Status

- Monorepo scaffold is in place
- Web and API application roots are created
- Shared package placeholders are created
- K3s infrastructure folder is created
- Supporting docs folders are created

## Next Steps

1. Initialize the React app in `apps/web`
2. Initialize the ASP.NET Core projects in `apps/api/src`
3. Add EF Core packages and the first generated migration
4. Add K3s manifests and GitHub Actions workflows
