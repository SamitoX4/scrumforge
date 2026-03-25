# ScrumForge

**SaaS de gestión ágil (Scrum/Kanban) multi-tenant con IA integrada**

---

`Node.js 22` · `TypeScript` · `React 19` · `GraphQL` · `PostgreSQL` · `Docker` · `AGPL-3.0`

---

## Descripción

ScrumForge es una plataforma SaaS multi-tenant de gestión ágil que permite a cualquier equipo crear su propio Workspace aislado con datos, miembros y configuración completamente independientes. Combina metodología Scrum y tableros Kanban con inteligencia artificial integrada para asistir en estimaciones, criterios de aceptación y detección de riesgos. Sigue una arquitectura open-core: el núcleo completo se publica bajo AGPL-3.0, mientras que las funcionalidades avanzadas se distribuyen como extensiones npm privadas bajo el scope `@scrumforge/` con licencia comercial.

---

## Características del core (AGPL-3.0)

- Backlog jerárquico (Épicas → Historias → Tareas) con drag & drop
- Sprints: planificación, tablero Kanban, burndown, velocidad
- Retrospectivas (Start/Stop/Continue, 4Ls, Sailboat, Glad/Sad/Mad…)
- Impedimentos con escalado automático
- Definition of Done, dependencias entre historias
- Reportes básicos, notificaciones en tiempo real (WebSocket)
- Auditoría de cambios, módulo de automatización
- Multi-tenant con invitaciones, roles (PO, SM, Dev, Stakeholder) y GDPR
- Auth: JWT con rotación de refresh tokens + Google OAuth
- i18n: español e inglés

---

## Extensiones premium

| Extensión | Feature | Vars requeridas |
|---|---|---|
| `planning-poker` | Estimación por votación en tiempo real | — |
| `ai` | Sugerencias IA: story points, criterios de aceptación, riesgos | `ANTHROPIC_API_KEY` |
| `advanced-reports` | Cumulative Flow, Lead/Cycle Time, export CSV | — |
| `retrospective-premium` | Dot voting + sincronización en tiempo real | — |
| `integrations` | GitHub, Slack, webhooks | `GITHUB_TOKEN`, `SLACK_WEBHOOK_URL` |
| `billing-stripe` | Checkout y portal de cliente con Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `wiki` | Wiki colaborativa por proyecto | — |

> Las extensiones premium se distribuyen como paquetes npm privados bajo licencia comercial.
> Para obtener acceso contacta con **raulbengalysamameascorbe@gmail.com**.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js 22 · Apollo Server 5 · Prisma 7 · PostgreSQL 16 · Express 5 · graphql-ws 6 |
| Frontend | React 19 · TypeScript 5.9 · Vite 8 · Apollo Client 4 · Zustand 5 · dnd-kit · Recharts 3 |
| IA | Anthropic SDK (`claude-haiku-4-5-20251001`) |
| Pagos | Stripe 20 |
| Auth | JWT + Google OAuth (Passport.js) |
| Realtime | WebSocket via graphql-ws 6 + PubSub |
| Cache | Redis (opcional — fallback a memoria) |

---

## Inicio rápido (desarrollo local)

```bash
# 1. Clonar
git clone https://github.com/SamitoX4/scrumforge.git && cd scrumforge

# 2. Infraestructura (PostgreSQL + Redis)
docker compose up -d

# 3. Backend
cd backend && cp .env.example .env   # editar DATABASE_URL y JWT_SECRET
npm install && npm run db:migrate && npm run db:seed && npm run dev

# 4. Frontend (nueva terminal)
cd frontend && cp .env.example .env
npm install && npm run dev
```

> Abre http://localhost:5173 · login demo: `admin@scrumforge.dev` / `Admin123`

---

## Deploy en producción

ScrumForge soporta tres modos de HTTPS configurables mediante la variable `HTTPS_MODE`: `off` (desarrollo local), `proxy` (detrás de Caddy/Nginx/ALB) y `standalone` (el backend gestiona TLS directamente).

### Docker Compose — VPS o servidor único

La opción más sencilla para un solo servidor: Caddy gestiona TLS automáticamente con Let's Encrypt.

```bash
# Crear .env en la raíz con DOMAIN, CADDY_EMAIL, POSTGRES_PASSWORD, JWT_SECRET
docker compose -f docker-compose.caddy.yml up -d
```

Para despliegue HTTP-only o detrás de un proxy existente, usa `docker-compose.prod.yml`.

### Kubernetes — alta disponibilidad y escalado automático

ScrumForge incluye manifiestos listos para Kubernetes en el directorio `k8s/`:

- Deployments con **rolling update zero-downtime**
- **HPA** (autoescalado): backend 2→10 réplicas, frontend 2→5 réplicas
- **Health checks** completos (liveness, readiness, startup)
- **Ingress nginx** con TLS automático via cert-manager + Let's Encrypt
- **WebSocket** soportado en el ingress (suscripciones GraphQL en tiempo real)
- Job de **migraciones** previo al despliegue

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-postgres.yaml
kubectl apply -f k8s/02-redis.yaml
# ... ver k8s/README.md para el flujo completo
```

Consulta la [Guía de Kubernetes](./k8s/README.md) y la [Guía de instalación completa](./SETUP.md) para todos los detalles.

---

## Estructura del repositorio

```
scrumforge/
├── backend/                  # Apollo Server + Express + Prisma
│   ├── src/
│   │   ├── modules/          # Módulos del core (auth, sprint, backlog…)
│   │   ├── extensions/       # Carga dinámica de extensiones premium
│   │   ├── middleware/       # Rate limiting, auth, HTTPS, RBAC
│   │   └── graphql/          # Schema GraphQL unificado
│   ├── Dockerfile
│   └── .env.example
├── frontend/                 # React + Vite + TypeScript
│   ├── src/
│   │   ├── features/         # Vistas del core
│   │   ├── extensions/       # Carga dinámica de extensiones UI
│   │   └── components/       # Átomos, moléculas, organismos
│   ├── Dockerfile
│   └── .env.example
├── packages/
│   ├── backend-sdk/          # @scrumforge/backend-sdk
│   └── frontend-sdk/         # @scrumforge/frontend-sdk
├── docker-compose.yml        # Infraestructura local (Postgres + Redis)
├── docker-compose.prod.yml   # Stack completo (sin TLS)
├── docker-compose.caddy.yml  # Stack con Caddy + TLS automático
├── Caddyfile                 # Configuración de Caddy
└── k8s/                      # Manifiestos Kubernetes (namespace, postgres, redis, backend, frontend, ingress)
```

---

## Tests

```bash
cd backend  && npm test   # 89/89 (Jest)
cd frontend && npm test   # 271/271 (Vitest)
```

---

## Documentación

- [Guía de instalación completa](./SETUP.md)
- [Despliegue en Kubernetes](./k8s/README.md)
- [Monitoreo y seguridad operacional](./doc/MONITORING.md)
- [Configuración de Stripe](./doc/STRIPE_SETUP.md)
- [Plan de seguridad](./doc/SECURITY_PLAN.md)
- [Guía de contribución](./CONTRIBUTING.md)
- [Política de seguridad](./SECURITY.md)

---

## Licencia

El **core** de ScrumForge se distribuye bajo la licencia [AGPL-3.0](./LICENSE). Puedes usarlo, modificarlo y redistribuirlo siempre que mantengas la misma licencia y publiques las modificaciones.

Las **extensiones premium** son software propietario distribuido como paquetes npm privados bajo el scope `@scrumforge/`. Su uso requiere una licencia comercial. No se permite su redistribución, modificación ni ingeniería inversa.

Para adquirir una licencia o solicitar acceso: **raulbengalysamameascorbe@gmail.com**
