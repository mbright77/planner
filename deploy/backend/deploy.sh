#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="${HOME}/deployments/planner"
BUNDLE_PATH="/tmp/backend-deploy-bundle.tar.gz"

mkdir -p "${DEPLOY_ROOT}"
tar -xzf "${BUNDLE_PATH}" -C "${DEPLOY_ROOT}" --strip-components=2

export BACKEND_K8S_NAMESPACE="brightroom"
export BACKEND_K8S_DEPLOYMENT_NAME="planner-api"
export BACKEND_K8S_SERVICE_NAME="planner-api"
export BACKEND_CONTAINER_PORT="8080"
export BACKEND_ASPNETCORE_PATH_BASE="/planner-api"
export ASPNETCORE_ENVIRONMENT="Production"

if [[ -z "${IMAGE_REF:-}" ]]; then
  printf 'IMAGE_REF is required.\n' >&2
  exit 1
fi

if [[ -z "${PLANNER_CONNECTION_STRING:-}" ]]; then
  printf 'PLANNER_CONNECTION_STRING is required.\n' >&2
  exit 1
fi

if [[ -z "${PLANNER_JWT_SIGNING_KEY:-}" ]]; then
  printf 'PLANNER_JWT_SIGNING_KEY is required.\n' >&2
  exit 1
fi

export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://mbright77.github.io}"
export JWT_ISSUER="${JWT_ISSUER:-planner-api}"
export JWT_AUDIENCE="${JWT_AUDIENCE:-planner-web}"
export GHCR_USERNAME="${GHCR_USERNAME:-}"
export GHCR_TOKEN="${GHCR_TOKEN:-}"
export GHCR_EMAIL="${GHCR_EMAIL:-actions@github.com}"
export GHCR_IMAGE_PULL_SECRET_NAME="${GHCR_IMAGE_PULL_SECRET_NAME:-ghcr-pull-secret}"

cd "${DEPLOY_ROOT}"

kubectl create namespace "${BACKEND_K8S_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

if [[ -n "${GHCR_USERNAME}" && -n "${GHCR_TOKEN}" ]]; then
  kubectl -n "${BACKEND_K8S_NAMESPACE}" create secret docker-registry "${GHCR_IMAGE_PULL_SECRET_NAME}" \
    --docker-server="ghcr.io" \
    --docker-username="${GHCR_USERNAME}" \
    --docker-password="${GHCR_TOKEN}" \
    --docker-email="${GHCR_EMAIL}" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

kubectl -n "${BACKEND_K8S_NAMESPACE}" create configmap "${BACKEND_K8S_DEPLOYMENT_NAME}-config" \
  --from-literal=ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT}" \
  --from-literal=PathBase="${BACKEND_ASPNETCORE_PATH_BASE}" \
  --from-literal=AllowedOrigins="${ALLOWED_ORIGINS}" \
  --from-literal=Jwt__Issuer="${JWT_ISSUER}" \
  --from-literal=Jwt__Audience="${JWT_AUDIENCE}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "${BACKEND_K8S_NAMESPACE}" create secret generic "${BACKEND_K8S_DEPLOYMENT_NAME}-secrets" \
  --from-literal=ConnectionStrings__Planner="${PLANNER_CONNECTION_STRING}" \
  --from-literal=Jwt__SigningKey="${PLANNER_JWT_SIGNING_KEY}" \
  --dry-run=client -o yaml | kubectl apply -f -

IMAGE_PULL_SECRETS_BLOCK=""
if [[ -n "${GHCR_USERNAME}" && -n "${GHCR_TOKEN}" ]]; then
  IMAGE_PULL_SECRETS_BLOCK=$(cat <<EOF
      imagePullSecrets:
        - name: ${GHCR_IMAGE_PULL_SECRET_NAME}
EOF
)
fi

cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${BACKEND_K8S_DEPLOYMENT_NAME}
  namespace: ${BACKEND_K8S_NAMESPACE}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${BACKEND_K8S_DEPLOYMENT_NAME}
  template:
    metadata:
      labels:
        app: ${BACKEND_K8S_DEPLOYMENT_NAME}
    spec:
${IMAGE_PULL_SECRETS_BLOCK}
      containers:
        - name: api
          image: ${IMAGE_REF}
          imagePullPolicy: Always
          ports:
            - containerPort: ${BACKEND_CONTAINER_PORT}
              name: http
          envFrom:
            - configMapRef:
                name: ${BACKEND_K8S_DEPLOYMENT_NAME}-config
            - secretRef:
                name: ${BACKEND_K8S_DEPLOYMENT_NAME}-secrets
          readinessProbe:
            httpGet:
              path: ${BACKEND_ASPNETCORE_PATH_BASE}/health/ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 3
          livenessProbe:
            httpGet:
              path: ${BACKEND_ASPNETCORE_PATH_BASE}/health/live
              port: http
            initialDelaySeconds: 20
            periodSeconds: 20
            timeoutSeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
EOF

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: ${BACKEND_K8S_SERVICE_NAME}
  namespace: ${BACKEND_K8S_NAMESPACE}
spec:
  type: ClusterIP
  selector:
    app: ${BACKEND_K8S_DEPLOYMENT_NAME}
  ports:
    - port: 8080
      targetPort: http
      protocol: TCP
      name: http
EOF

kubectl -n "${BACKEND_K8S_NAMESPACE}" rollout status deployment/"${BACKEND_K8S_DEPLOYMENT_NAME}" --timeout=180s

printf '\n=== Deployment Status ===\n'
kubectl get deployment,service,ingress -n "${BACKEND_K8S_NAMESPACE}"

printf '\n=== Pod Details ===\n'
kubectl get pods -n "${BACKEND_K8S_NAMESPACE}" -o wide

printf '\n=== Recent Events ===\n'
kubectl get events -n "${BACKEND_K8S_NAMESPACE}" --sort-by='.lastTimestamp' | tail -20 || true
