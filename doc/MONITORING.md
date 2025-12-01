# ScrumForge — Guía de Monitoreo, Observabilidad y Seguridad Operacional

## Índice

1. [Qué monitorear en ScrumForge](#1-qué-monitorear-en-scrumforge)
2. [Filosofía: los tres pilares de la observabilidad](#2-filosofía-los-tres-pilares-de-la-observabilidad)
3. [Entorno VPS / Docker Compose (sin Kubernetes)](#3-entorno-vps--docker-compose-sin-kubernetes)
4. [Entorno Kubernetes](#4-entorno-kubernetes)
5. [Comparativa de herramientas](#5-comparativa-de-herramientas)
6. [Logging estructurado — Pino y agregación de logs](#6-logging-estructurado--pino-y-agregación-de-logs)
7. [Alertas — qué, cuándo y a quién](#7-alertas--qué-cuándo-y-a-quién)
8. [Seguridad operacional](#8-seguridad-operacional)
9. [Recomendación por escenario](#9-recomendación-por-escenario)

---

## 1. Qué monitorear en ScrumForge

Antes de elegir herramientas, hay que saber exactamente qué puntos críticos tiene esta aplicación:

### Backend (Node.js / Apollo Server / Express)

| Métrica | Por qué importa |
|---|---|
| `GET /health` — código HTTP | El endpoint verifica la DB activamente; un 503 significa que la app está caída |
| Latencia de queries GraphQL | Degradación silenciosa antes de que los usuarios se quejen |
| Errores GraphQL (`errors[]` en respuesta) | Apollo devuelve siempre 200; los errores van dentro del body |
| Conexiones WebSocket activas | Las suscripciones en tiempo real consumen memoria; una fuga es invisible sin métrica |
| Rate limit hits (429) | Ataques de fuerza bruta en `/graphql` o endpoints de auth |
| Uso de CPU y memoria del proceso Node | Node es single-thread; un pico de CPU bloquea todo el servidor |
| Tiempo de respuesta de Anthropic API | Las llamadas de IA son lentas y pueden afectar la UX |
| Webhooks de Stripe — tasa de éxito | Un webhook fallido puede dejar una suscripción sin activar |

### Base de datos (PostgreSQL)

| Métrica | Por qué importa |
|---|---|
| Conexiones activas vs. pool máximo | Prisma usa connection pooling; agotar el pool congela el backend |
| Queries lentas (> 100 ms) | Indica falta de índices o N+1 queries |
| Tamaño de la base de datos | Multi-tenant — un workspace puede crecer inesperadamente |
| Replication lag | Solo relevante si tienes réplica de lectura |
| Lock waits | Bloqueos entre transacciones concurrentes |

### Redis

| Métrica | Por qué importa |
|---|---|
| Uso de memoria | Redis tiene memoria limitada; si se llena, empieza a expulsar claves |
| Hit rate | Si es bajo, el caché no está funcionando bien |
| Conexiones | Fugas de conexión desde el backend |

### Infraestructura del servidor

| Métrica | Por qué importa |
|---|---|
| CPU, RAM, disco | Recursos del host |
| Espacio en disco (PostgreSQL data dir) | Una DB que llena el disco corrompe datos |
| Tráfico de red entrante/saliente | Detección de DDoS o exfiltración |
| Certificado TLS — días para expirar | Let's Encrypt renueva automáticamente, pero el proceso puede fallar |

---

## 2. Filosofía: los tres pilares de la observabilidad

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   MÉTRICAS  │    │    LOGS     │    │   TRAZAS    │
│             │    │             │    │             │
│ ¿Qué pasa?  │    │ ¿Por qué?   │    │ ¿Dónde?     │
│ (números)   │    │ (eventos)   │    │ (recorrido) │
└─────────────┘    └─────────────┘    └─────────────┘
```

- **Métricas**: valores numéricos a lo largo del tiempo (Prometheus, Datadog). Responden "¿hay un problema ahora?"
- **Logs**: eventos textuales estructurados (Pino → Loki/ELK). Responden "¿qué pasó exactamente?"
- **Trazas distribuidas**: el recorrido de una petición a través de servicios (OpenTelemetry, Jaeger). Responden "¿dónde se perdió el tiempo?"

Para ScrumForge en producción mínima viable necesitas **métricas + logs**. Las trazas son el siguiente nivel.

---

## 3. Entorno VPS / Docker Compose (sin Kubernetes)

### Opción A — Netdata (recomendado para empezar, 5 minutos)

**Qué es:** agente ligero que se instala en el host y expone un dashboard en tiempo real sin configuración.

**Ventajas:** instalación en un comando, cero config, detecta automáticamente Docker, PostgreSQL, Redis, Node.js, nginx. Tiene alertas built-in.

**Limitación:** el plan cloud gratuito guarda 14 días de historial. Para retención larga necesitas el plan de pago o exportar a Prometheus.

```bash
# Instalación en el host (fuera de Docker)
wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh
sh /tmp/netdata-kickstart.sh --stable-channel

# El dashboard queda disponible en: http://TU_IP:19999
# En producción: proteger con Nginx/Caddy + autenticación básica
```

Para que Netdata monitoree PostgreSQL y Redis automáticamente, solo necesita que los servicios sean accesibles. Detecta contenedores Docker por socket.

---

### Opción B — Prometheus + Grafana + Alertmanager (recomendado para producción)

**El stack más completo en open source.** Requiere más configuración pero da control total.

#### Arquitectura

```
ScrumForge Backend ──► Node Exporter ──► Prometheus ──► Grafana (dashboards)
PostgreSQL          ──► postgres_exporter ──►          ──► Alertmanager (alertas)
Redis               ──► redis_exporter ──►             └──► PagerDuty / Slack / Email
Host                ──► node_exporter ──►
```

#### docker-compose.monitoring.yml (añadir al repo)

```yaml
version: '3.9'

volumes:
  prometheus_data:
  grafana_data:

networks:
  monitoring:
    driver: bridge

services:

  # ── Prometheus — recolector de métricas ────────────────────────────────────
  prometheus:
    image: prom/prometheus:v2.51.0
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "127.0.0.1:9090:9090"   # Solo localhost — no exponer a internet
    networks:
      - monitoring
    restart: unless-stopped

  # ── Grafana — dashboards ───────────────────────────────────────────────────
  grafana:
    image: grafana/grafana:10.4.0
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
    environment:
      GF_SECURITY_ADMIN_PASSWORD: "CAMBIAR_CONTRASEÑA"
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_SERVER_ROOT_URL: "https://monitoring.tudominio.com"
    ports:
      - "127.0.0.1:3001:3000"   # Solo localhost
    networks:
      - monitoring
    restart: unless-stopped

  # ── Alertmanager — routing de alertas ──────────────────────────────────────
  alertmanager:
    image: prom/alertmanager:v0.27.0
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    ports:
      - "127.0.0.1:9093:9093"
    networks:
      - monitoring
    restart: unless-stopped

  # ── Exporters ──────────────────────────────────────────────────────────────
  node-exporter:
    image: prom/node-exporter:v1.7.0
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
    pid: host
    networks:
      - monitoring
    restart: unless-stopped

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    environment:
      DATA_SOURCE_NAME: "postgresql://scrumforge:PASSWORD@postgres:5432/scrumforge?sslmode=disable"
    networks:
      - monitoring
      - default       # Para acceder al contenedor postgres de scrumforge
    restart: unless-stopped

  redis-exporter:
    image: oliver006/redis_exporter:v1.58.0
    environment:
      REDIS_ADDR: "redis://redis:6379"
    networks:
      - monitoring
      - default
    restart: unless-stopped
```

#### monitoring/prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/alerts.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Health check del backend como blackbox
  - job_name: 'scrumforge-health'
    metrics_path: /health
    static_configs:
      - targets: ['backend:4000']
    # Prometheus no entiende JSON directamente como métrica,
    # pero puede detectar el código HTTP (200 vs 503)
```

#### monitoring/alerts.yml (alertas esenciales)

```yaml
groups:
  - name: scrumforge
    rules:

      - alert: BackendDown
        expr: up{job="scrumforge-health"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "ScrumForge backend no responde"
          description: "El endpoint /health lleva más de 1 minuto sin responder"

      - alert: DatabaseConnectionsHigh
        expr: pg_stat_activity_count > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Conexiones PostgreSQL altas ({{ $value }})"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.15
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Disco al {{ $value | humanizePercentage }} de capacidad"

      - alert: HighCPU
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CPU alta: {{ $value }}%"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Memoria al {{ $value | humanizePercentage }}"
```

**Dashboards de Grafana recomendados** (importar por ID):
- `1860` — Node Exporter Full (host)
- `9628` — PostgreSQL Database
- `763` — Redis Dashboard
- `11074` — Node.js Application (si añades métricas Prometheus al backend)

---

### Opción C — Datadog / New Relic / Dynatrace (SaaS)

**Cuándo elegirlos:** cuando el tiempo de configuración importa más que el coste, o cuando el equipo no quiere gestionar infraestructura de monitoreo.

| Herramienta | Fortaleza | Precio orientativo |
|---|---|---|
| **Datadog** | El más completo; APM, logs, infraestructura, RUM todo integrado | ~$23/host/mes + extras |
| **New Relic** | Muy buen APM para Node.js; modelo de precios por GB ingerido | Gratis hasta 100 GB/mes |
| **Dynatrace** | IA para detección de anomalías; autodetección de dependencias | ~$69/host/mes |
| **Netdata Cloud** | Netdata open source + cloud; más sencillo que los anteriores | Gratis (14 días) / $90/nodo/año |

**Instalación Datadog en Docker Compose** (ejemplo):

```yaml
# Añadir al docker-compose.prod.yml
datadog-agent:
  image: datadog/agent:7
  environment:
    DD_API_KEY: "${DATADOG_API_KEY}"
    DD_SITE: "datadoghq.com"
    DD_LOGS_ENABLED: "true"
    DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL: "true"
    DD_PROCESS_AGENT_ENABLED: "true"
    DD_DOCKER_LABELS_AS_TAGS: '{"service":"scrumforge"}'
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - /proc/:/host/proc/:ro
    - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
  restart: unless-stopped
```

---

### Opción D — Zabbix (enterprise, agent-based)

**Cuándo elegirlo:** entornos enterprise que ya usan Zabbix para toda la infraestructura, o cuando se necesita monitoreo SNMP de red además de servicios.

**Para ScrumForge** es sobredimensionado a menos que ya lo tengas instalado en tu infraestructura. La curva de configuración es alta comparada con Prometheus/Grafana.

---

### Monitoreo externo de uptime (imprescindible)

El monitoreo interno no te avisa si el servidor entero se cae. Siempre añade un servicio externo que haga ping desde fuera:

| Servicio | Plan gratuito | Intervalo mínimo |
|---|---|---|
| **UptimeRobot** | 50 monitores, 5 min | 5 minutos (gratis) / 1 min (pago) |
| **Better Uptime** | 10 monitores, 3 min | 3 minutos |
| **Freshping** | 50 monitores, 1 min | 1 minuto |

Configurar un monitor HTTP para `https://api.tudominio.com/health` que alerte por email/Slack si devuelve != 200.

---

## 4. Entorno Kubernetes

### kube-prometheus-stack (recomendado — todo en uno)

El stack estándar de la industria para Kubernetes. Instala Prometheus Operator, Grafana, Alertmanager, kube-state-metrics y node-exporter en un solo comando Helm.

```bash
# Añadir repo de Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Instalar en namespace dedicado
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword="CAMBIAR_CONTRASEÑA" \
  --set prometheus.prometheusSpec.retention="30d" \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=20Gi
```

**Qué monitorea automáticamente:** todos los pods, nodos, deployments, PVCs, ingress, uso de recursos del clúster, certificados TLS (si usas cert-manager).

**Acceder a Grafana:**
```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
# → http://localhost:3000
```

#### ServiceMonitor para el backend de ScrumForge

Para que Prometheus raspe métricas del backend necesitas añadir un endpoint `/metrics` al backend (ver sección de integración más abajo) y un ServiceMonitor:

```yaml
# k8s/servicemonitor-backend.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: scrumforge-backend
  namespace: scrumforge
  labels:
    release: kube-prometheus-stack
spec:
  selector:
    matchLabels:
      app: scrumforge-backend
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

---

### SigNoz (alternativa open source todo en uno)

**Qué es:** plataforma open source que combina métricas, logs y trazas distribuidas (OpenTelemetry nativo) en una sola interfaz. Alternativa a Datadog sin coste de licencia.

**Cuándo elegirlo sobre kube-prometheus-stack:** cuando también quieres trazas distribuidas (ver de qué resolver GraphQL viene la latencia) sin gestionar Jaeger por separado.

```bash
helm repo add signoz https://charts.signoz.io
helm install signoz signoz/signoz \
  --namespace platform \
  --create-namespace
```

---

### Loki + Promtail (logs en Kubernetes)

Para agregar los logs de Pino (JSON estructurado) en Kubernetes:

```bash
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set promtail.enabled=true \
  --set loki.persistence.enabled=true \
  --set loki.persistence.size=20Gi
```

Promtail recoge automáticamente los logs de todos los pods y los envía a Loki. Grafana ya incluido en kube-prometheus-stack puede consultarlos.

---

### Falco (seguridad runtime en Kubernetes)

**Qué hace:** detecta comportamiento anómalo en tiempo real dentro de los pods (ejecución de shells inesperadas, acceso a ficheros sensibles, escalada de privilegios, conexiones de red inusuales).

```bash
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm install falco falcosecurity/falco \
  --namespace falco \
  --create-namespace \
  --set falco.grpc.enabled=true \
  --set falco.grpcOutput.enabled=true
```

Reglas relevantes para ScrumForge que Falco detecta por defecto:
- Shell abierta en el contenedor del backend en producción
- Lectura de `/etc/passwd` o `/etc/shadow` desde un contenedor
- Conexión saliente a IP no esperada desde el pod de PostgreSQL

---

## 5. Comparativa de herramientas

| Herramienta | Tipo | Entorno | Dificultad | Coste | Mejor para |
|---|---|---|---|---|---|
| **Netdata** | Agente host | VPS | ★☆☆ | Gratis / $90/año | Empezar rápido, VPS único |
| **Prometheus + Grafana** | Self-hosted | VPS / K8s | ★★☆ | Gratis | Producción seria, control total |
| **kube-prometheus-stack** | Helm chart | Kubernetes | ★★☆ | Gratis | K8s — estándar de la industria |
| **SigNoz** | Self-hosted | K8s | ★★☆ | Gratis / SaaS | Métricas + logs + trazas juntos |
| **Loki + Promtail** | Self-hosted | VPS / K8s | ★★☆ | Gratis | Logs estructurados a bajo coste |
| **Datadog** | SaaS | Cualquiera | ★☆☆ | Alto | Empresas con presupuesto |
| **New Relic** | SaaS | Cualquiera | ★☆☆ | Medio (gratis hasta 100 GB) | APM Node.js sin gestión |
| **Dynatrace** | SaaS | Cualquiera | ★☆☆ | Alto | Autodetección con IA |
| **Zabbix** | Self-hosted | VPS / bare metal | ★★★ | Gratis | Infraestructura enterprise ya existente |
| **Falco** | Seguridad runtime | Kubernetes | ★★☆ | Gratis | Detección de intrusiones en pods |
| **UptimeRobot** | SaaS externo | Cualquiera | ★☆☆ | Gratis | Uptime externo — siempre necesario |

---

## 6. Logging estructurado — Pino y agregación de logs

ScrumForge usa **Pino** con JSON estructurado y redact automático de campos sensibles (passwords, tokens, API keys). Esto lo hace directamente compatible con cualquier sistema de agregación de logs.

### Formato de log en producción

```json
{
  "level": 30,
  "time": 1711234567890,
  "pid": 1,
  "hostname": "scrumforge-backend-7d9f8b",
  "method": "POST",
  "path": "/graphql",
  "ip": "1.2.3.4",
  "msg": "HTTP request"
}
```

Los campos sensibles aparecen como `"[REDACTED]"` gracias al redact de Pino.

### Pipeline de logs recomendado

```
Pino (stdout JSON)
    │
    ▼
Promtail / Fluentd / Logstash
    │
    ▼
Loki (open source, barato)        ← recomendado
  o Elasticsearch (potente, caro)
  o CloudWatch / GCP Logging      ← si estás en cloud
    │
    ▼
Grafana / Kibana
```

### Configurar Pino para que los logs sean legibles en desarrollo

En producción los logs van en JSON a stdout (correcto para agregación). En desarrollo, instalar `pino-pretty`:

```bash
# backend/.env (desarrollo)
# Los logs JSON se pipean a pino-pretty automáticamente si está en el PATH
npm run dev | npx pino-pretty
```

---

## 7. Alertas — qué, cuándo y a quién

### Niveles de severidad

| Nivel | Ejemplo | Acción | Canal |
|---|---|---|---|
| **Critical** | Backend caído, DB sin espacio en disco | Despertar en cualquier hora | PagerDuty / llamada |
| **Warning** | CPU > 85%, conexiones DB altas | Revisar en horario laboral | Slack / email |
| **Info** | Deploy completado, cert renovado | Log solamente | Canal Slack #ops |

### Alertas mínimas para ScrumForge

```
CRITICAL:
- Backend /health devuelve != 200 durante > 2 minutos
- Disco del servidor > 85% de uso
- PostgreSQL no responde
- Certificado TLS expira en < 7 días

WARNING:
- CPU > 85% durante 5 minutos
- Memoria > 90%
- Conexiones PostgreSQL > 80% del pool
- Redis memoria > 80%
- Latencia /health > 500ms
- Tasa de errores GraphQL > 5% en 5 minutos

INFO:
- Deploy nuevo completado
- Backup ejecutado correctamente
- Certificado TLS renovado
```

### Integración de alertas con Slack (Alertmanager)

```yaml
# monitoring/alertmanager.yml
route:
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'slack-notifications'

  routes:
    - match:
        severity: critical
      receiver: 'slack-critical'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/TU_WEBHOOK'
        channel: '#alerts-scrumforge'
        title: '[{{ .Status | toUpper }}] {{ .CommonAnnotations.summary }}'
        text: '{{ .CommonAnnotations.description }}'

  - name: 'slack-critical'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/TU_WEBHOOK'
        channel: '#alerts-critical'
        title: '🚨 CRÍTICO: {{ .CommonAnnotations.summary }}'
```

---

## 8. Seguridad operacional

### 8.1 Hardening del servidor (VPS)

```bash
# Actualizar el sistema regularmente
apt update && apt upgrade -y

# Fail2ban — banear IPs con demasiados intentos fallidos
apt install fail2ban
# Configurar jail para SSH y para el puerto 4000 (GraphQL brute force)

# UFW — solo abrir los puertos necesarios
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirige a HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
# El puerto 4000 del backend NO debe estar expuesto — solo Caddy/nginx llega a él

# Deshabilitar login SSH por contraseña — solo claves
# /etc/ssh/sshd_config:
#   PasswordAuthentication no
#   PermitRootLogin no
```

### 8.2 Rotación de secretos

| Secreto | Frecuencia recomendada | Cómo |
|---|---|---|
| `JWT_SECRET` | Cada 90 días | Cambiar en .env + reiniciar backend (los tokens activos expiran según `JWT_EXPIRES_IN`) |
| `POSTGRES_PASSWORD` | Cada 90 días | Cambiar en PostgreSQL + `DATABASE_URL` |
| `STRIPE_SECRET_KEY` | Solo si hay sospecha | Dashboard de Stripe |
| `ANTHROPIC_API_KEY` | Solo si hay sospecha | Console de Anthropic |
| Claves SSH del servidor | Cada año | Regenerar en el servidor |

### 8.3 Backups automatizados

```bash
# Script de backup diario — añadir a crontab
# crontab -e
# 0 2 * * * /opt/scripts/backup-scrumforge.sh

#!/bin/bash
BACKUP_DIR="/backups/scrumforge"
DATE=$(date +%Y%m%d_%H%M)
mkdir -p $BACKUP_DIR

# Backup de PostgreSQL
docker exec scrumforge-db pg_dump -U scrumforge scrumforge | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Eliminar backups de más de 30 días
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completado: $BACKUP_DIR/db_$DATE.sql.gz"
```

**Regla 3-2-1:** 3 copias, en 2 medios distintos, 1 fuera del sitio. Al menos sincronizar el directorio `/backups` a un bucket S3 / Backblaze B2.

### 8.4 Dependencias y vulnerabilidades

ScrumForge ya tiene `npm audit` recomendado en CI. Completar con:

```bash
# Ejecutar en local antes de cada release
cd backend && npm audit --audit-level=high
cd frontend && npm audit --audit-level=high

# Actualizar dependencias con parches de seguridad
npm update

# Dependabot (GitHub) — ya activo según CLAUDE.md
# Configura en .github/dependabot.yml para PRs automáticos de seguridad
```

### 8.5 Revisión de logs de seguridad

Búsquedas habituales en los logs de Pino que indican actividad sospechosa:

```bash
# Demasiados 429 desde la misma IP (ataque de fuerza bruta)
docker logs scrumforge-backend | grep '"statusCode":429' | grep -oP '"ip":"\K[^"]+' | sort | uniq -c | sort -rn | head

# Errores de autenticación en ráfaga
docker logs scrumforge-backend | grep 'UNAUTHENTICATED' | grep -oP '"ip":"\K[^"]+' | sort | uniq -c | sort -rn | head

# Intentos de introspección GraphQL (bloqueados en producción)
docker logs scrumforge-backend | grep '__schema'
```

### 8.6 Escaneo de imágenes Docker

Antes de hacer push de una imagen a producción:

```bash
# Con Trivy (gratuito, open source)
brew install trivy   # o apt install trivy

trivy image your-registry/scrumforge-backend:1.0.0
trivy image your-registry/scrumforge-frontend:1.0.0

# Solo reportar vulnerabilidades HIGH y CRITICAL
trivy image --severity HIGH,CRITICAL your-registry/scrumforge-backend:1.0.0
```

---

## 9. Recomendación por escenario

### Escenario A — Un solo VPS, presupuesto mínimo

```
Monitoreo:   Netdata (gratis, 5 min setup)
Uptime:      UptimeRobot (gratis)
Logs:        docker logs + logrotate (sin agregación)
Alertas:     UptimeRobot → email
Seguridad:   fail2ban + ufw + npm audit
Backups:     script cron → Backblaze B2 ($0.006/GB/mes)
```

Coste adicional: **~$0/mes**

---

### Escenario B — VPS / Docker Compose, producción seria

```
Monitoreo:   Prometheus + Grafana + Alertmanager (self-hosted, mismo servidor o VPS aparte)
Logs:        Pino → Loki → Grafana
Uptime:      UptimeRobot o Better Uptime
Alertas:     Alertmanager → Slack + email
Seguridad:   fail2ban + ufw + Trivy en CI + npm audit
Backups:     script cron → S3 o Backblaze B2 + prueba de restauración mensual
```

Coste adicional: **$5-10/mes** (VPS pequeño para el stack de monitoreo)

---

### Escenario C — Kubernetes, self-hosted

```
Monitoreo:   kube-prometheus-stack (Helm)
Logs:        Loki + Promtail (Helm)
Trazas:      SigNoz (si se añade OpenTelemetry al backend)
Uptime:      UptimeRobot
Alertas:     Alertmanager → PagerDuty + Slack
Seguridad:   Falco + Trivy en CI + Sealed Secrets
Backups:     Velero (backups de PVCs de Kubernetes) → S3
```

Coste adicional: **~$20-40/mes** en recursos del clúster para el stack de observabilidad

---

### Escenario D — Kubernetes, equipo con presupuesto

```
Monitoreo + Logs + Trazas:   Datadog o New Relic (SaaS, zero-ops)
Uptime:                      integrado en Datadog/New Relic
Alertas:                     integradas + PagerDuty
Seguridad:                   Datadog Security Monitoring + Falco
Backups:                     Velero → S3
```

Coste adicional: **$50-200/mes** según el número de nodos y volumen de logs

---

### Mi recomendación para ScrumForge hoy

Empezar con el **Escenario B**: Prometheus + Grafana + Loki en un VPS pequeño aparte (o en el mismo servidor con límites de memoria). Razones:

1. **Control total** de los datos — los logs y métricas no salen de tu infraestructura
2. **Coste mínimo** — todo open source
3. **Escala a Kubernetes** sin cambiar de herramientas — kube-prometheus-stack usa exactamente el mismo stack
4. Los logs de Pino son JSON estructurado — Loki los indexa perfectamente sin transformación
5. El endpoint `/health` ya está listo para que Prometheus lo raspe

Añadir **UptimeRobot** (gratis) desde el primer día para tener visibilidad externa independiente.
