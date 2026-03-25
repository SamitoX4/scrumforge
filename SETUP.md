# ScrumForge — Guía de instalación y operación

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Desarrollo local](#2-desarrollo-local)
3. [Variables de entorno](#3-variables-de-entorno)
4. [HTTPS — modos de despliegue](#4-https--modos-de-despliegue)
5. [Sistema de extensiones](#5-sistema-de-extensiones)
6. [Instalar extensiones premium](#6-instalar-extensiones-premium)
7. [Desarrollar extensiones](#7-desarrollar-extensiones)
8. [Deploy con Docker — escenarios](#8-deploy-con-docker--escenarios) (incluye Kubernetes)
9. [Tests](#9-tests)
10. [Base de datos](#10-base-de-datos)
11. [Credenciales de demo](#11-credenciales-de-demo)
12. [Planes y límites](#12-planes-y-límites)
13. [Referencia rápida de comandos](#13-referencia-rápida-de-comandos)
14. [Solución de problemas](#14-solución-de-problemas)

---

## 1. Requisitos previos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | 22 | Requerido por el backend |
| pnpm | 9 | Gestor de paquetes usado en este proyecto |
| Docker | 24 | Para PostgreSQL y Redis |
| Docker Compose | v2 | Incluido con Docker Desktop |

```bash
node --version    # v22.x.x
pnpm --version    # 9.x.x  (instalar: npm install -g pnpm)
docker --version  # Docker version 24.x.x
```

> **¿Por qué pnpm?** Los lockfiles (`pnpm-lock.yaml`) commiteados garantizan instalaciones reproducibles. npm también funciona pero generará un `package-lock.json` diferente.

---

## 2. Desarrollo local

### Clonar el repositorio

```bash
git clone https://github.com/your-org/scrumforge.git
cd scrumforge
```

> Este repo contiene el **core AGPL** completo. Para desarrollar con extensiones premium
> consulta el [§6 — Opción A](#opción-a--desarrollo-local-con-el-repo-privado-clonado).

### Levantar la infraestructura (PostgreSQL + Redis)

```bash
docker compose up -d
```

Verifica que los contenedores están listos (≈10 s):

```bash
docker compose ps
# postgres   running (healthy)
# redis      running (healthy)
```

### Configurar el backend

```bash
cd backend
cp .env.example .env
```

Edita `.env` — solo dos variables son obligatorias para arrancar:

```env
DATABASE_URL="postgresql://scrumforge:scrumforge123@localhost:5432/scrumforge"
JWT_SECRET="pon-aqui-una-cadena-aleatoria-de-al-menos-32-caracteres"
```

Instala dependencias, aplica migraciones y carga datos de demo:

```bash
pnpm install
```

> **pnpm bloquea postinstall scripts por seguridad.** Tras el primer `pnpm install` debes aprobar los scripts de Prisma y generar el cliente manualmente:
>
> ```bash
> pnpm approve-builds          # selecciona @prisma/engines y prisma
> pnpm install                 # reinstala ejecutando los scripts aprobados
> # si el cliente aún no existe:
> npx prisma generate --schema=src/config/db/schema.prisma
> ```

```bash
npm run db:migrate
npm run db:seed
npm run dev
# → API disponible en http://localhost:4000/graphql
```

### Configurar el frontend

Abre una segunda terminal:

```bash
cd frontend
cp .env.example .env
pnpm install
npm run dev
# → App disponible en http://localhost:5173
```

El `.env` por defecto apunta a `localhost:4000`. Si tu backend está en otra dirección, edita `VITE_GRAPHQL_URL`, `VITE_WS_URL` y `VITE_BACKEND_URL`.

---

## 3. Variables de entorno

### Backend — requeridas (el servidor no arranca sin ellas)

```env
DATABASE_URL="postgresql://scrumforge:scrumforge123@localhost:5432/scrumforge"
JWT_SECRET="cambia-esto-por-un-secreto-largo"
```

### Backend — servidor (con valores por defecto)

```env
NODE_ENV="development"          # development | production | test
PORT=4000
BACKEND_URL="http://localhost:4000"   # Usado para el callback de Google OAuth
FRONTEND_URL="http://localhost:5173"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"
LOG_LEVEL="info"                # trace | debug | info | warn | error | fatal
```

### Backend — HTTPS

```env
HTTPS_MODE=off          # off (por defecto) | proxy | standalone
TLS_CERT_PATH=          # solo para HTTPS_MODE=standalone
TLS_KEY_PATH=           # solo para HTTPS_MODE=standalone
HTTP_PORT=80            # solo para HTTPS_MODE=standalone (puerto HTTP para redirección 301)
```

### Backend — extensiones

```env
# CSV de extensiones a cargar.
# Sin definir → sin extensiones (producción)
# Vacío       → sin extensiones (core puro)
ENABLED_EXTENSIONS=planning-poker,ai,integrations,advanced-reports,retrospective-premium,billing-stripe,wiki
```

### Backend — servicios opcionales

Cada variable solo es necesaria si la extensión correspondiente está activada:

```env
# ── IA (extensión 'ai') ────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Google OAuth ───────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── Email — Resend (preferido si está definido) ────────────────────────────
RESEND_API_KEY=re_...

# ── Email — Nodemailer (alternativa a Resend) ──────────────────────────────
MAIL_SERVICE=Gmail
MAIL_USER=tu@gmail.com
MAIL_PASS=contraseña-de-aplicación
ADMIN_EMAIL=admin@tudominio.com

# ── Stripe (extensión 'billing-stripe') ────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...

# ── GitHub (extensión 'integrations') ──────────────────────────────────────
GITHUB_TOKEN=ghp_...

# ── Slack (extensión 'integrations') ───────────────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# ── Redis (caché opcional — modo degradado si no está definido) ────────────
REDIS_URL=redis://localhost:6379
```

> Si no se configura ningún servicio de email, el servidor imprime los emails
> en la consola en lugar de enviarlos.

### Frontend

```env
VITE_GRAPHQL_URL=http://localhost:4000/graphql
VITE_WS_URL=ws://localhost:4000/graphql
VITE_BACKEND_URL=http://localhost:4000

# CSV de extensiones UI a incluir en el bundle (debe sincronizarse con ENABLED_EXTENSIONS)
# Sin definir o vacío → sin extensiones UI
VITE_ENABLED_EXTENSIONS=planning-poker,ai,integrations,advanced-reports,retrospective-premium,billing-stripe,wiki
```

> **Regla clave:** `ENABLED_EXTENSIONS` (backend) y `VITE_ENABLED_EXTENSIONS` (frontend)
> deben estar sincronizadas. Si el backend no carga una extensión, el frontend la
> mostrará pero las queries fallarán.

---

## 4. HTTPS — modos de despliegue

ScrumForge soporta tres modos de HTTPS configurados mediante `HTTPS_MODE`:

### Modo `off` (por defecto)

Para desarrollo local. HTTP funciona con normalidad, no se aplica ninguna redirección ni verificación TLS.

```env
HTTPS_MODE=off
```

### Modo `proxy` — detrás de Caddy, Nginx o ALB

El proxy externo termina TLS y reenvía las peticiones al backend con la cabecera `X-Forwarded-Proto: https`. El backend detecta esta cabecera y redirige cualquier petición HTTP plana con un `301`.

Este es el modo recomendado para producción con `docker-compose.caddy.yml`:

```bash
# .env en la raíz del repo
DOMAIN=scrumforge.miempresa.com
CADDY_EMAIL=admin@miempresa.com
POSTGRES_PASSWORD=...
JWT_SECRET=...

docker compose -f docker-compose.caddy.yml up -d
```

Caddy obtiene y renueva automáticamente el certificado Let's Encrypt. Solo los puertos 80 y 443 quedan expuestos al exterior.

```env
# backend/.env
HTTPS_MODE=proxy
```

### Modo `standalone` — el backend gestiona TLS directamente

El servidor Express escucha en HTTPS sin necesidad de proxy. Requiere que los ficheros de certificado sean accesibles en el contenedor o servidor:

```env
HTTPS_MODE=standalone
TLS_CERT_PATH=/etc/letsencrypt/live/tu-dominio.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/tu-dominio.com/privkey.pem
HTTP_PORT=80
```

El backend levantará un listener adicional en `HTTP_PORT` que redirige todo el tráfico a HTTPS con `301`.

**Certificado autofirmado para dev/staging:**

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
```

Apunta `TLS_CERT_PATH` a `cert.pem` y `TLS_KEY_PATH` a `key.pem`.

---

## 5. Sistema de extensiones

ScrumForge usa una arquitectura **Open Core**:

- El **core** (AGPL-3.0) incluye: auth, workspaces, backlog, sprints, tablero Kanban, reportes básicos, retrospectiva básica, notificaciones, auditoría.
- Las **extensiones premium** añaden features avanzadas y se instalan como paquetes npm privados.

### Extensiones disponibles

| Nombre | Feature | Vars de entorno necesarias |
|---|---|---|
| `planning-poker` | Sesiones de estimación en tiempo real | — |
| `ai` | Sugerencias IA (story points, criterios, riesgos, automatización) | `ANTHROPIC_API_KEY` |
| `integrations` | GitHub + Slack + webhooks | `GITHUB_TOKEN`, `SLACK_WEBHOOK_URL` |
| `advanced-reports` | Cumulative Flow, Lead/Cycle Time, export CSV | — |
| `retrospective-premium` | Dot voting + sincronización en tiempo real | — |
| `billing-stripe` | Gestión de suscripciones Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `wiki` | Wiki colaborativa por proyecto | — |

> **Las extensiones premium requieren licencia comercial.**
> Para solicitar acceso escribe a **raulbengalysamameascorbe@gmail.com** indicando las extensiones que necesitas y el entorno de despliegue (desarrollo / producción). Se te proporcionará el token de acceso al registro privado de paquetes.

### Cómo funciona

**Backend:** al arrancar, lee `ENABLED_EXTENSIONS` y carga cada extensión habilitada. En el modo de desarrollo (y en despliegues self-hosted con el repo clonado), las extensiones se resuelven como módulos locales desde `backend/src/extensions/<nombre>/`. En despliegues que usen paquetes npm privados publicados, se resuelven desde `node_modules/@scrumforge/backend-ext-<nombre>`. En ambos casos el mecanismo es idéntico: los `typeDefs` y `resolvers` de cada extensión se fusionan con el schema del core antes de que Apollo Server arranque.

**Frontend:** antes de montar React (`main.tsx`), `loadFrontendExtensions()` lee `VITE_ENABLED_EXTENSIONS` e importa dinámicamente cada módulo de extensión. Cada extensión registra nav items, rutas y slots de UI.

---

## 6. Instalar extensiones premium

Las extensiones se distribuyen como paquetes privados en GitHub Packages bajo el scope `@scrumforge`.

**Nomenclatura de paquetes:**
- Backend: `@scrumforge/backend-ext-<nombre>`
- Frontend: `@scrumforge/frontend-ext-<nombre>`

### Paso previo — Solicitar acceso

Antes de poder instalar cualquier extensión necesitas una **licencia comercial** y un token de acceso al registro privado. Escribe a **raulbengalysamameascorbe@gmail.com** indicando:

- Las extensiones que necesitas (`planning-poker`, `ai`, `wiki`…)
- Si es para desarrollo/evaluación o producción

Una vez confirmada la licencia se te proporcionará el `GITHUB_TOKEN` necesario para el paso de autenticación que aparece a continuación.

---

Hay dos formas de instalarlas según tu situación:

---

### Opción A — Desarrollo local con el repo privado clonado

Si tienes acceso al repositorio privado `scrumforge-extensions`, clónalo **junto** al repo público (misma carpeta padre):

```
carpeta-de-trabajo/
├── scrumforge/               ← repo público (este repo)
└── scrumforge-extensions/    ← repo privado (extensiones)
```

```bash
git clone https://github.com/tu-org/scrumforge.git
git clone https://github.com/tu-org/scrumforge-extensions.git
```

#### Instalar extensiones del backend (referencias locales)

```bash
cd scrumforge/backend
npm install \
  file:../../scrumforge-extensions/packages/backend-ext-planning-poker \
  file:../../scrumforge-extensions/packages/backend-ext-ai \
  file:../../scrumforge-extensions/packages/backend-ext-integrations \
  file:../../scrumforge-extensions/packages/backend-ext-advanced-reports \
  file:../../scrumforge-extensions/packages/backend-ext-retrospective-premium \
  file:../../scrumforge-extensions/packages/backend-ext-billing-stripe \
  file:../../scrumforge-extensions/packages/backend-ext-wiki
```

> Las extensiones backend deben compilarse antes del primer `npm install`.
> Desde `scrumforge-extensions/`, ejecuta una vez:
> ```bash
> for pkg in backend-ext-{planning-poker,ai,integrations,advanced-reports,retrospective-premium,billing-stripe,wiki}; do
>   (cd packages/$pkg && node ../../node_modules/.bin/tsup --no-dts)
> done
> ```

#### Frontend — sin `npm install` (aliases automáticos)

El frontend **no necesita `npm install`** para las extensiones. Cuando Vite detecta que `scrumforge-extensions/` existe junto al repo, activa automáticamente aliases que apuntan al código fuente de cada extensión.

Solo activa las extensiones en `frontend/.env`:

```env
VITE_ENABLED_EXTENSIONS=planning-poker,ai,integrations,advanced-reports,retrospective-premium,billing-stripe,wiki
```

#### Activar extensiones del backend

Edita `backend/.env`:

```env
ENABLED_EXTENSIONS=planning-poker,ai,integrations,advanced-reports,retrospective-premium,billing-stripe,wiki
```

Reinicia backend y frontend:

```bash
# Terminal 1
cd scrumforge/backend && npm run dev

# Terminal 2
cd scrumforge/frontend && npm run dev
```

---

### Opción B — Producción con paquetes publicados en GitHub Packages

#### 1. Autenticarse en el registro privado

```bash
# Opción A — login interactivo
npm login --registry=https://npm.pkg.github.com --scope=@scrumforge

# Opción B — token en ~/.npmrc (recomendado para CI/CD)
echo "@scrumforge:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=TU_GITHUB_TOKEN" >> ~/.npmrc
```

#### 2. Instalar extensiones del backend

```bash
cd backend
npm install \
  @scrumforge/backend-ext-planning-poker \
  @scrumforge/backend-ext-ai \
  @scrumforge/backend-ext-integrations \
  @scrumforge/backend-ext-advanced-reports \
  @scrumforge/backend-ext-retrospective-premium \
  @scrumforge/backend-ext-billing-stripe \
  @scrumforge/backend-ext-wiki
```

Activa en `backend/.env`:

```env
ENABLED_EXTENSIONS=planning-poker,ai,wiki   # solo las que hayas instalado
```

#### 3. Instalar extensiones del frontend

```bash
cd frontend
npm install \
  @scrumforge/frontend-ext-planning-poker \
  @scrumforge/frontend-ext-ai \
  @scrumforge/frontend-ext-integrations \
  @scrumforge/frontend-ext-advanced-reports \
  @scrumforge/frontend-ext-retrospective-premium \
  @scrumforge/frontend-ext-billing-stripe \
  @scrumforge/frontend-ext-wiki
```

Activa en `frontend/.env`:

```env
VITE_ENABLED_EXTENSIONS=planning-poker,ai,wiki   # debe coincidir con ENABLED_EXTENSIONS
```

> **Importante:** las variables `VITE_*` se hornean en el bundle en **build time**.
> Después de instalar paquetes o cambiar `VITE_ENABLED_EXTENSIONS` debes reconstruir:
> ```bash
> npm run build   # producción
> npm run dev     # o reiniciar el dev server
> ```

#### 4. Instalar en Docker (antes del build)

```bash
# Backend — instalar extensiones en backend/node_modules
(cd backend && npm install @scrumforge/backend-ext-planning-poker @scrumforge/backend-ext-ai)

# Frontend — instalar extensiones en frontend/node_modules
(cd frontend && npm install @scrumforge/frontend-ext-planning-poker @scrumforge/frontend-ext-ai)

# Construir imágenes (desde la raíz del repo)
docker build -f backend/Dockerfile -t scrumforge-backend .
docker build \
  --build-arg VITE_ENABLED_EXTENSIONS=planning-poker,ai \
  -f frontend/Dockerfile -t scrumforge-frontend .
```

---

### Stripe — testing de webhooks en local

Para probar el flujo de pagos en desarrollo necesitas reenviar los eventos de Stripe al backend local:

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe   # o ver https://stripe.com/docs/stripe-cli

# Autenticarse y reenviar webhooks al backend local
stripe login
stripe listen --forward-to localhost:4000/webhooks/stripe
# La CLI imprime whsec_... → copiar en STRIPE_WEBHOOK_SECRET
```

Añade el `whsec_...` impreso por la CLI a `backend/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 7. Desarrollar extensiones

Todo el trabajo de extensiones ocurre dentro del repo privado `scrumforge-extensions/`.
No hay que tocar el repo público salvo en dos casos puntuales que se indican abajo.

### Modificar una extensión existente

**Frontend** — sin fricción. Vite apunta directamente al `src/` de la extensión mediante alias, por lo que cualquier cambio se refleja al instante con hot reload:

```bash
# Edita el archivo en scrumforge-extensions/packages/frontend-ext-<nombre>/src/
# El navegador se actualiza solo — no hace falta reiniciar nada.
```

**Backend** — requiere recompilar porque Node consume el `dist/`. Para no tener que hacerlo manualmente en cada cambio, levanta `tsup --watch` en una terminal dedicada:

```bash
# Terminal exclusiva para la extensión que estás tocando:
cd scrumforge-extensions/packages/backend-ext-<nombre>
node ../../node_modules/.bin/tsup --watch

# Cuando tsup detecta un cambio y recompila, tsx watch (npm run dev del backend)
# recarga el módulo automáticamente.
```

### Añadir una extensión nueva

#### 1. Crear los paquetes en el repo privado

```
scrumforge-extensions/packages/
├── backend-ext-nueva/
│   ├── package.json        # "name": "@scrumforge/backend-ext-nueva"
│   ├── tsconfig.json
│   ├── tsup.config.ts
│   └── src/index.ts        # exporta ScrumForgeExtension como default
└── frontend-ext-nueva/
    ├── package.json        # "name": "@scrumforge/frontend-ext-nueva"
    ├── tsconfig.json
    ├── tsup.config.ts
    └── src/index.ts        # exporta ScrumForgeFrontendExtension como default
```

#### 2. Registrar el nombre corto en el repo público

Añade una entrada en los dos mapas de carga — son los únicos archivos del repo público que hay que tocar:

```ts
// backend/src/extensions/load-extensions.ts
const EXTENSION_MAP = {
  ...
  'nueva': '@scrumforge/backend-ext-nueva',
};
```

```ts
// frontend/src/extensions/load-extensions.ts
const EXTENSION_MAP = {
  ...
  'nueva': '@scrumforge/frontend-ext-nueva',
};
```

#### 3. Conectar para desarrollo local

```bash
# Compilar el backend de la nueva extensión
cd scrumforge-extensions/packages/backend-ext-nueva
node ../../node_modules/.bin/tsup --no-dts

# Instalar en el backend del repo público
cd scrumforge/backend
npm install file:../../scrumforge-extensions/packages/backend-ext-nueva
```

Añade el alias de Vite en `frontend/vite.config.ts` (dentro de la función `extAlias` ya existente, sigue el mismo patrón de las otras 7 entradas).

#### 4. Activar

```env
# backend/.env
ENABLED_EXTENSIONS=...,nueva

# frontend/.env
VITE_ENABLED_EXTENSIONS=...,nueva
```

---

## 8. Deploy con Docker — escenarios

> **Regla de oro:** todos los comandos `docker build` y `docker compose`
> deben ejecutarse desde la **raíz del repositorio** (`scrumforge/`),
> no desde las subcarpetas `backend/` o `frontend/`.

### Escenario 1 — Un solo servidor (stack completo)

Ideal para staging, VPS pequeño o demo. Levanta Postgres + Redis + Backend + Frontend en un solo host.

```bash
# 1. Clonar el repo
git clone https://github.com/your-org/scrumforge.git
cd scrumforge

# 2. Crear el archivo de entorno
cp backend/.env.example backend/.env
# Editar backend/.env: POSTGRES_PASSWORD, JWT_SECRET, y las vars de extensiones

# 3. Levantar el stack completo
docker compose -f docker-compose.prod.yml up -d

# 4. Primer arranque: aplicar migraciones y seed
docker exec scrumforge-backend npx prisma migrate deploy
docker exec scrumforge-backend npm run db:seed   # solo la primera vez

# 5. Ver logs
docker compose -f docker-compose.prod.yml logs -f
```

Variables de entorno requeridas en `backend/.env` (o como variables del sistema):

```env
POSTGRES_PASSWORD=elige-una-contraseña-segura
JWT_SECRET=cadena-aleatoria-de-32-caracteres
ENABLED_EXTENSIONS=planning-poker,ai,wiki   # las que tengas instaladas

# URLs del frontend que se usan en el compose (hornea en el build de Vite)
VITE_GRAPHQL_URL=https://tudominio.com/graphql
VITE_WS_URL=wss://tudominio.com/graphql
VITE_BACKEND_URL=https://tudominio.com
VITE_ENABLED_EXTENSIONS=planning-poker,ai,wiki
```

Comandos de gestión:

```bash
docker compose -f docker-compose.prod.yml down          # detener
docker compose -f docker-compose.prod.yml restart       # reiniciar
docker compose -f docker-compose.prod.yml pull          # actualizar imágenes
```

---

### Escenario 2 — Stack con TLS automático (Caddy)

Para producción con HTTPS gestionado por Caddy y Let's Encrypt.

```bash
# Crear .env en la raíz del repo
cat > .env <<EOF
DOMAIN=scrumforge.miempresa.com
CADDY_EMAIL=admin@miempresa.com
POSTGRES_PASSWORD=contraseña-segura
JWT_SECRET=cadena-aleatoria-larga
HTTPS_MODE=proxy
EOF

docker compose -f docker-compose.caddy.yml up -d
```

Caddy renueva automáticamente el certificado. Solo los puertos 80 y 443 quedan accesibles desde el exterior.

---

### Escenario 3 — Servidores separados

Backend en un servidor (API), frontend en otro (CDN/servidor estático).

#### Servidor A — Backend

```bash
git clone https://github.com/your-org/scrumforge.git
cd scrumforge

# (Opcional) instalar extensiones privadas antes del build
cd backend && npm install @scrumforge/backend-ext-planning-poker && cd ..

# Construir la imagen (desde la raíz del repo)
docker build -f backend/Dockerfile -t scrumforge-backend .

# Levantar con su propio stack (Postgres + Redis + Backend)
cp backend/.env.example backend/.env
# Editar backend/.env

docker compose -f backend/docker-compose.yml up -d

# Primer arranque
docker exec scrumforge-backend npx prisma migrate deploy
docker exec scrumforge-backend npm run db:seed
```

#### Servidor B — Frontend

```bash
git clone https://github.com/your-org/scrumforge.git
cd scrumforge

# (Opcional) instalar extensiones UI antes del build
cd frontend && npm install @scrumforge/frontend-ext-planning-poker && cd ..

# Construir la imagen pasando las URLs del backend como args
docker build \
  --build-arg VITE_GRAPHQL_URL=https://api.tudominio.com/graphql \
  --build-arg VITE_WS_URL=wss://api.tudominio.com/graphql \
  --build-arg VITE_BACKEND_URL=https://api.tudominio.com \
  --build-arg VITE_ENABLED_EXTENSIONS=planning-poker,ai,wiki \
  -f frontend/Dockerfile \
  -t scrumforge-frontend .

# Levantar
VITE_GRAPHQL_URL=https://api.tudominio.com/graphql \
VITE_WS_URL=wss://api.tudominio.com/graphql \
VITE_BACKEND_URL=https://api.tudominio.com \
docker compose -f frontend/docker-compose.yml up -d
```

---

### Escenario 4 — Imágenes independientes (sin compose)

Para integraciones CI/CD, Kubernetes, etc.

```bash
# Desde la raíz del repo:

# Backend
docker build -f backend/Dockerfile -t scrumforge-backend:latest .

docker run -d \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/scrumforge" \
  -e JWT_SECRET="secreto-largo-aleatorio" \
  -e NODE_ENV="production" \
  -e BACKEND_URL="https://api.tudominio.com" \
  -e FRONTEND_URL="https://tudominio.com" \
  -e ENABLED_EXTENSIONS="planning-poker,ai,wiki" \
  --name scrumforge-backend \
  scrumforge-backend:latest

# Frontend
docker build \
  --build-arg VITE_GRAPHQL_URL=https://api.tudominio.com/graphql \
  --build-arg VITE_WS_URL=wss://api.tudominio.com/graphql \
  --build-arg VITE_BACKEND_URL=https://api.tudominio.com \
  --build-arg VITE_ENABLED_EXTENSIONS=planning-poker,ai,wiki \
  -f frontend/Dockerfile \
  -t scrumforge-frontend:latest .

docker run -d -p 80:80 --name scrumforge-frontend scrumforge-frontend:latest
```

---

### Escenario 5 — Kubernetes

Para despliegues con alta disponibilidad, autoescalado y zero-downtime, ScrumForge incluye manifiestos Kubernetes listos para usar en el directorio `k8s/`.

**Qué incluye:**

| Archivo | Contenido |
|---|---|
| `00-namespace.yaml` | Namespace `scrumforge` |
| `01-postgres.yaml` | PVC + Deployment + Service de PostgreSQL |
| `02-redis.yaml` | Deployment + Service de Redis |
| `03-migrations-job.yaml` | Job: `prisma migrate deploy` previo al backend |
| `04-backend.yaml` | ConfigMap + Secret + Deployment (HPA 2→10) + Service |
| `05-frontend.yaml` | Deployment (HPA 2→5) + Service |
| `06-ingress.yaml` | Ingress nginx con TLS cert-manager + soporte WebSocket |
| `06b-cluster-issuer.yaml` | ClusterIssuer Let's Encrypt (staging + prod) |

**Aplicar en orden:**

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-postgres.yaml
kubectl apply -f k8s/02-redis.yaml
kubectl apply -f k8s/06b-cluster-issuer.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n scrumforge --timeout=60s
kubectl apply -f k8s/03-migrations-job.yaml
kubectl wait --for=condition=complete job/scrumforge-migrations -n scrumforge --timeout=120s
kubectl apply -f k8s/04-backend.yaml
kubectl apply -f k8s/05-frontend.yaml
kubectl apply -f k8s/06-ingress.yaml
```

> Consulta [k8s/README.md](../k8s/README.md) para el flujo completo: requisitos previos, construcción de imágenes, personalización de dominios y secretos, actualización de versiones y comandos de gestión habituales.

---

## 9. Tests

### Backend (Jest)

```bash
cd backend
npm test                                          # Todos los tests
npm run test:watch                                # Modo watch
ENABLED_EXTENSIONS= npx jest                      # Core sin extensiones
npx jest --coverage                               # Con cobertura
npx tsc --noEmit                                  # Verificar tipos
```

Estado actual: **89/89 tests**

### Frontend (Vitest)

```bash
cd frontend
npm test                    # Run once
npx vitest                  # Modo watch interactivo
npm run test:ui             # Interfaz visual en el navegador
npx tsc --noEmit            # Verificar tipos
```

Estado actual: **271/271 tests**

---

## 10. Base de datos

```bash
# Aplicar migraciones pendientes (desarrollo)
npm run db:migrate
# Equivale a: npx prisma migrate dev

# Aplicar migraciones en producción (sin generar nuevas)
npm run db:migrate:prod
# Equivale a: npx prisma migrate deploy

# Poblar con datos de demo
npm run db:seed

# Reset completo (borra todos los datos — pide confirmación)
npm run db:reset

# Regenerar cliente Prisma (tras cambios en schema.prisma)
npm run db:generate

# GUI visual de la base de datos
npm run db:studio
# → http://localhost:5555

# Crear nueva migración
npx prisma migrate dev --name descripcion_del_cambio

# Conectarse a PostgreSQL directamente
docker exec -it scrumforge-db psql -U scrumforge -d scrumforge

# Backup
docker exec scrumforge-db pg_dump -U scrumforge scrumforge > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i scrumforge-db psql -U scrumforge scrumforge < backup_20260320.sql
```

---

## 11. Credenciales de demo

Creadas por `npm run db:seed`:

| Email | Contraseña | Rol |
|---|---|---|
| `admin@scrumforge.dev` | `password123` | Scrum Master + Owner |
| `po@scrumforge.dev` | `password123` | Product Owner |
| `sm@scrumforge.dev` | `password123` | Scrum Master |
| `dev@scrumforge.dev` | `password123` | Developer |
| `dev2@scrumforge.dev` | `password123` | Developer |

> **Nota sobre contraseñas:** `password123` funciona para las cuentas pre-seeded porque el hash ya está almacenado en la base de datos. Sin embargo, cualquier registro nuevo requiere una contraseña que cumpla la política de seguridad: **mínimo 8 caracteres, al menos una mayúscula, una minúscula y un dígito**.

---

## 12. Planes y límites

| Feature | Free | Pro | Business |
|---|:---:|:---:|:---:|
| Proyectos | 1 | Ilimitado | Ilimitado |
| Miembros | 5 | 25 | Ilimitado |
| Almacenamiento | 1 GB | 10 GB | 100 GB |
| Historial de sprints | 3 | Ilimitado | Ilimitado |
| Planning Poker | No | Si | Si |
| Reportes avanzados | No | Si | Si |
| Integraciones GitHub/Slack | No | Si | Si |
| Retrospectiva premium | No | Si | Si |
| Wiki colaborativa | No | Si | Si |
| IA (story points, criterios) | No | Si | Si |
| Automatización IA | No | No | Si |
| Billing Stripe | — | Si | Si |

Cambiar el plan de un workspace manualmente:

```sql
SELECT id, name FROM "Plan";
UPDATE "Subscription"
SET "planId" = '<id-del-plan-pro>'
WHERE "workspaceId" = '<id-del-workspace>';
```

---

## 13. Referencia rápida de comandos

### Infraestructura (desarrollo local)

```bash
docker compose up -d          # Levantar PostgreSQL + Redis
docker compose down           # Detener servicios
docker compose ps             # Ver estado
docker compose logs -f        # Ver logs en tiempo real
```

### Backend

```bash
npm run dev                   # Servidor en modo watch
npm run build                 # Compilar TypeScript → dist/
npm start                     # Ejecutar build compilado (producción)
npm test                      # Todos los tests
npx tsc --noEmit              # Verificar tipos
```

### Base de datos

```bash
npm run db:migrate            # Aplicar migraciones (dev)
npm run db:migrate:prod       # Aplicar migraciones (producción)
npm run db:seed               # Poblar con datos de demo
npm run db:reset              # Borrar todo y reaplicar
npm run db:generate           # Regenerar cliente Prisma
npm run db:studio             # GUI en http://localhost:5555
```

### Frontend

```bash
npm run dev                   # Vite dev server (http://localhost:5173)
npm run build                 # Build de producción → dist/
npm run preview               # Preview del build
npm test                      # Vitest (run once)
npx vitest                    # Vitest modo watch
npx tsc --noEmit              # Verificar tipos
```

### Docker (siempre desde la raíz del repo)

```bash
# Stack completo (sin TLS)
docker compose -f docker-compose.prod.yml up -d

# Stack con TLS automático (Caddy)
docker compose -f docker-compose.caddy.yml up -d

# Solo backend (con su propia DB)
docker compose -f backend/docker-compose.yml up -d

# Solo frontend
docker compose -f frontend/docker-compose.yml up -d

# Builds individuales
docker build -f backend/Dockerfile  -t scrumforge-backend  .
docker build -f frontend/Dockerfile -t scrumforge-frontend .
```

---

## 14. Solución de problemas

### `connect EHOSTUNREACH` al arrancar el backend

La base de datos no está corriendo:

```bash
docker compose up -d
```

### `table does not exist` (error de Prisma)

Las migraciones no se han aplicado:

```bash
cd backend && npm run db:migrate
```

### Error de Prisma Client desactualizado

```bash
cd backend && npm run db:generate
```

### Una extensión no aparece aunque está configurada

1. Verifica que el nombre en `ENABLED_EXTENSIONS` coincide con la tabla de la sección 5 (minúsculas, con guiones).
2. El backend loggea `[Extensions] Cargando extensiones: ...` al arrancar — si muestra un `warn`, el paquete no está instalado.
3. El frontend loggea `[FrontendExtensions] Cargando extensiones: ...` en la consola del navegador.
4. Verifica que el paquete está en `node_modules`: `ls backend/node_modules/@scrumforge/`.

### El frontend no refleja cambios en `VITE_ENABLED_EXTENSIONS`

Las variables `VITE_*` se hornean en el bundle en **build time**. Reinicia Vite (`npm run dev`) o rehaz el build de producción.

### Puerto 4000 o 5173 ya en uso

```bash
lsof -i :4000    # ver qué proceso usa el puerto
# Cambiar en backend/.env:
PORT=4001
```

### Error al hacer `docker build` (packages not found)

Asegúrate de ejecutar el build desde la **raíz del repo**, no desde `backend/` o `frontend/`:

```bash
# Incorrecto
cd backend && docker build -t scrumforge-backend .

# Correcto
cd scrumforge  && docker build -f backend/Dockerfile -t scrumforge-backend .
```

### El backend no redirige a HTTPS en modo `proxy`

Verifica que el proxy (Caddy/Nginx) está enviando la cabecera `X-Forwarded-Proto: https`. Con Caddy esto ocurre automáticamente; con Nginx asegúrate de tener:

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

### Error de certificado en modo `standalone`

Comprueba que las rutas `TLS_CERT_PATH` y `TLS_KEY_PATH` existen y son legibles por el proceso Node. En Docker, monta los ficheros con un volumen:

```bash
docker run ... \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -e TLS_CERT_PATH=/etc/letsencrypt/live/tu-dominio.com/fullchain.pem \
  -e TLS_KEY_PATH=/etc/letsencrypt/live/tu-dominio.com/privkey.pem \
  ...
```
