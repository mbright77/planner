# Infra Scripts

Operational helper scripts live here.

Current committed scripts:

- `deploy-api.sh`: update the API deployment image and automatically roll back on failed rollout
- `rollback-api.sh`: roll back the API deployment to the previous or specified revision
- `migrate-db.sh`: run EF Core database migrations with an explicit connection string
