# ScrumForge — Despliegue en Kubernetes

## Estructura

```
k8s/
├── 00-namespace.yaml        # Namespace scrumforge
├── 01-postgres.yaml         # PVC + Deployment + Service de PostgreSQL
├── 02-redis.yaml            # Deployment + Service de Redis
├── 03-migrations-job.yaml   # Job de prisma migrate deploy (ejecutar antes del backend)
├── 04-backend.yaml          # ConfigMap + Secret + Deployment + Service + HPA
├── 05-frontend.yaml         # Deployment + Service + HPA
├── 06-ingress.yaml          # Ingress nginx con TLS automático (cert-manager)
└── 06b-cluster-issuer.yaml  # ClusterIssuer de cert-manager (aplicar una sola vez)
```

---

## Requisitos previos

### 1. Clúster Kubernetes
Cualquier distribución compatible: EKS, GKE, AKS, k3s, kind…

### 2. nginx Ingress Controller
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### 3. cert-manager (TLS automático con Let's Encrypt)
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/instance=cert-manager \
  --timeout=120s
```

### 4. metrics-server (para que funcione el HPA)
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### 5. Registro de contenedores
Necesitas un registro donde publicar las imágenes (Docker Hub, GitHub Container Registry, AWS ECR, etc.).

---

## Paso a paso — primer despliegue

### 1. Construir y publicar las imágenes

**Backend:**
```bash
# Desde la raíz del repositorio
docker build -f backend/Dockerfile -t your-registry/scrumforge-backend:1.0.0 .
docker push your-registry/scrumforge-backend:1.0.0
```

**Frontend** (las URLs se hornean en build time):
```bash
docker build \
  --build-arg VITE_GRAPHQL_URL=https://api.tudominio.com/graphql \
  --build-arg VITE_WS_URL=wss://api.tudominio.com/graphql \
  --build-arg VITE_BACKEND_URL=https://api.tudominio.com \
  --build-arg VITE_ENABLED_EXTENSIONS=planning-poker,ai,wiki \
  -f frontend/Dockerfile \
  -t your-registry/scrumforge-frontend:1.0.0 .
docker push your-registry/scrumforge-frontend:1.0.0
```

### 2. Personalizar los manifiestos

Edita los siguientes valores antes de aplicar:

| Archivo | Campo | Descripción |
|---|---|---|
| `01-postgres.yaml` | `POSTGRES_PASSWORD` | Contraseña de PostgreSQL |
| `04-backend.yaml` | `BACKEND_URL`, `FRONTEND_URL` | Dominios reales |
| `04-backend.yaml` | `DATABASE_URL` | URL con la contraseña de PostgreSQL |
| `04-backend.yaml` | `JWT_SECRET` | Cadena aleatoria ≥ 32 caracteres |
| `04-backend.yaml` | `ENABLED_EXTENSIONS` | Extensiones instaladas en la imagen |
| `04-backend.yaml` | `image` | `your-registry/scrumforge-backend:1.0.0` |
| `05-frontend.yaml` | `image` | `your-registry/scrumforge-frontend:1.0.0` |
| `06-ingress.yaml` | `tudominio.com` | Dominio real del frontend |
| `06-ingress.yaml` | `api.tudominio.com` | Dominio real del backend |

Generar un JWT_SECRET seguro:
```bash
openssl rand -base64 48
```

Alternativa recomendada — crear los Secrets directamente con kubectl (sin dejarlos en archivos):
```bash
kubectl create secret generic backend-secret \
  --namespace=scrumforge \
  --from-literal=DATABASE_URL='postgresql://scrumforge:PASSWORD@postgres:5432/scrumforge' \
  --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=REDIS_URL='redis://redis:6379'
```

### 3. Configurar DNS

Obtén la IP pública del Ingress Controller:
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
# → EXTERNAL-IP: 1.2.3.4
```

Crea registros A en tu proveedor DNS:
```
tudominio.com       A  1.2.3.4
api.tudominio.com   A  1.2.3.4
```

### 4. Aplicar los manifiestos en orden

```bash
# Namespace
kubectl apply -f k8s/00-namespace.yaml

# Infraestructura
kubectl apply -f k8s/01-postgres.yaml
kubectl apply -f k8s/02-redis.yaml

# cert-manager ClusterIssuer (una sola vez)
kubectl apply -f k8s/06b-cluster-issuer.yaml

# Esperar a que PostgreSQL esté listo
kubectl wait --for=condition=ready pod -l app=postgres -n scrumforge --timeout=60s

# Migraciones (ANTES del backend)
kubectl apply -f k8s/03-migrations-job.yaml
kubectl wait --for=condition=complete job/scrumforge-migrations -n scrumforge --timeout=120s

# Backend + Frontend
kubectl apply -f k8s/04-backend.yaml
kubectl apply -f k8s/05-frontend.yaml

# Ingress
kubectl apply -f k8s/06-ingress.yaml
```

### 5. Seed inicial (solo en el primer despliegue)

```bash
kubectl exec -n scrumforge deploy/scrumforge-backend -- npm run db:seed
```

### 6. Verificar el despliegue

```bash
kubectl get pods -n scrumforge
kubectl get ingress -n scrumforge
kubectl describe certificate scrumforge-tls -n scrumforge   # estado del certificado TLS
```

---

## Actualizar a una nueva versión

```bash
# 1. Construir y publicar nuevas imágenes con el nuevo tag
docker build -f backend/Dockerfile -t your-registry/scrumforge-backend:1.1.0 .
docker push your-registry/scrumforge-backend:1.1.0

# 2. Ejecutar migraciones de la nueva versión
kubectl set image job/scrumforge-migrations migrations=your-registry/scrumforge-backend:1.1.0 -n scrumforge
# O bien editar 03-migrations-job.yaml y aplicar de nuevo:
kubectl delete job scrumforge-migrations -n scrumforge
kubectl apply -f k8s/03-migrations-job.yaml
kubectl wait --for=condition=complete job/scrumforge-migrations -n scrumforge --timeout=120s

# 3. Actualizar el backend (rolling update — zero downtime)
kubectl set image deployment/scrumforge-backend backend=your-registry/scrumforge-backend:1.1.0 -n scrumforge
kubectl rollout status deployment/scrumforge-backend -n scrumforge

# 4. Actualizar el frontend si cambió
kubectl set image deployment/scrumforge-frontend frontend=your-registry/scrumforge-frontend:1.1.0 -n scrumforge
kubectl rollout status deployment/scrumforge-frontend -n scrumforge
```

---

## Comandos de gestión habituales

```bash
# Ver todos los recursos del namespace
kubectl get all -n scrumforge

# Logs del backend (todos los pods)
kubectl logs -n scrumforge -l app=scrumforge-backend --tail=100 -f

# Escalar manualmente el backend
kubectl scale deployment scrumforge-backend --replicas=4 -n scrumforge

# Acceder a la shell del backend
kubectl exec -it -n scrumforge deploy/scrumforge-backend -- sh

# Ver el estado del HPA
kubectl get hpa -n scrumforge

# Acceder a la DB desde dentro del clúster
kubectl exec -it -n scrumforge deploy/postgres -- psql -U scrumforge

# Backup de PostgreSQL
kubectl exec -n scrumforge deploy/postgres -- pg_dump -U scrumforge scrumforge > backup_$(date +%Y%m%d).sql

# Rollback del backend
kubectl rollout undo deployment/scrumforge-backend -n scrumforge
```

---

## Notas sobre producción

- **PostgreSQL y Redis en-clúster** son adecuados para empezar. Para cargas altas o datos críticos usa servicios gestionados (RDS, Cloud SQL, ElastiCache).
- **Secretos**: en producción considera usar un gestor de secretos (AWS Secrets Manager, HashiCorp Vault, Sealed Secrets) en lugar de Secrets de Kubernetes en archivos YAML.
- **Registro privado**: si tu registro requiere autenticación, crea un `imagePullSecret` y referencíalo en los Deployments.
- **Frontend URLs**: las variables `VITE_*` se hornean en el bundle. Si necesitas cambiarlas, hay que reconstruir y hacer push de la imagen del frontend.
