# Guía de Contribución — ScrumForge

## Bienvenido

¡Gracias por tu interés en contribuir a ScrumForge! Este proyecto es de código abierto bajo licencia **AGPL-3.0** y las contribuciones de la comunidad son bienvenidas. ScrumForge es una plataforma SaaS multi-tenant de gestión ágil (Scrum/Kanban) con integración de IA, construida con una arquitectura open-core: el núcleo es libre y las extensiones premium viven en un repositorio privado separado.

---

## Antes de empezar

Asegúrate de tener instalado en tu máquina:

- **Node.js 22**
- **Docker** (para PostgreSQL y Redis en desarrollo)
- **git**

Para las instrucciones completas de configuración del entorno local, consulta [SETUP.md](./SETUP.md).

---

## Flujo de trabajo

1. **Haz un fork** del repositorio en GitHub.

2. **Crea una rama** a partir de `main` con un nombre descriptivo:
   ```bash
   git checkout -b feat/nombre-feature
   # o para correcciones:
   git checkout -b fix/descripcion-bug
   ```

3. **Realiza tus cambios** siguiendo las convenciones descritas más abajo.

4. **Ejecuta los tests** y asegúrate de que todos pasan:
   ```bash
   cd backend && npm test
   cd frontend && npm test
   ```

5. **Ejecuta el chequeo de tipos** en ambos paquetes:
   ```bash
   # En backend/
   npx tsc --noEmit

   # En frontend/
   npx tsc --noEmit
   ```

6. **Crea un Pull Request** contra la rama `main` con una descripción clara del qué y el por qué de los cambios (ver sección [Pull Requests](#pull-requests)).

---

## Convenciones de código

### General

- **TypeScript estricto** — no uses `any` sin una justificación documentada en un comentario.
- **Comentarios en español**, tanto en el código fuente como en los mensajes de commit.
- **JSDoc en todas las funciones públicas**, incluyendo etiquetas `@param` y `@returns`.
- **No añadir manejo de errores especulativo** — solo captura y gestiona errores donde realmente puedan ocurrir. No envuelvas código en try/catch por precaución sin una razón concreta.

### Backend

- Cada módulo sigue la estructura estándar de cuatro ficheros:
  - `*.typedefs.ts` — definiciones de tipos GraphQL
  - `*.service.ts` — lógica de negocio
  - `*.resolver.ts` — resolvers de GraphQL
  - `*.repository.ts` — acceso a base de datos via Prisma
- Llama a `requireAuth(ctx)` al inicio de cada resolver que requiera autenticación.
- **Nunca expongas datos sensibles en GraphQL**: campos como `apiKey`, `password`, tokens, etc. no deben aparecer en las respuestas.
- Registra un **audit log** para operaciones destructivas e irreversibles.
- Las mutaciones de autenticación deben pasar por el middleware `authRateLimit`.

### Frontend

- **Estilos**: usa SCSS Modules o inline styles. No uses Tailwind ni librerías CSS-in-JS externas.
- **Estado global** gestionado con Zustand; los stores principales son `auth.store.ts` y `ui.store.ts`.
- **i18n obligatorio**: todas las cadenas visibles al usuario deben obtenerse via el hook `useTranslation()`. No uses strings literales en la UI.
- **Dark mode** implementado mediante CSS custom properties (`var(--bg-primary)`, `var(--text-primary)`, etc.). No uses valores de color hardcodeados.

---

## Política de contraseñas

La política de contraseñas del proyecto exige un mínimo de **8 caracteres**, al menos una **letra mayúscula**, una **letra minúscula** y un **dígito**.

La función `validatePassword()` ubicada en `backend/src/utils/password.utils.ts` es la **única fuente de verdad** para esta validación. No dupliques esta lógica en ningún otro lugar del código.

---

## Tests

- Todo **bug fix** debe incluir un test que reproduzca el error corregido.
- Los tests deben pasar en la **CI de GitHub Actions** antes de que el PR pueda ser mergeado.
- **No mockees la base de datos** en tests de integración; usa una instancia real de PostgreSQL (disponible via Docker Compose en el entorno de desarrollo).
- El comando `npm audit --audit-level=high --omit=dev` no debe reportar vulnerabilidades de nivel **HIGH** o **CRITICAL** en dependencias de producción.

---

## Seguridad

- No introduzcas vulnerabilidades del **OWASP Top 10**.
- **No loguees datos sensibles** (contraseñas, tokens, API keys). Pino tiene configurado `redact` para filtrar estos campos automáticamente; no los incluyas en mensajes de log manuales.
- Para reportar una **vulnerabilidad de seguridad**, consulta [SECURITY.md](./SECURITY.md). **No abras un issue público** para reportar vulnerabilidades.

---

## Commits

Usa el siguiente formato para los mensajes de commit:

```
tipo: descripción breve en español
```

**Tipos permitidos:**

| Tipo | Uso |
|------|-----|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de un bug |
| `refactor:` | Refactorización sin cambio funcional |
| `docs:` | Cambios en documentación |
| `test:` | Añadir o corregir tests |
| `chore:` | Tareas de mantenimiento (deps, config, etc.) |

**Ejemplos:**

```
feat: añadir validación de contraseña
fix: corregir rate limit en WebSocket
refactor: extraer lógica de auth a servicio dedicado
test: añadir tests para el resolver de workspaces
```

---

## Pull Requests

- **Título**: claro y conciso, menos de 70 caracteres.
- **Descripción**: explica el qué y el por qué del cambio, no solo el cómo. Si es relevante, incluye capturas de pantalla o ejemplos de uso.
- **Enlaza el issue relacionado** si existe (p. ej. `Closes #123`).
- **La CI debe pasar** (type-check, tests, build, npm audit) antes de que el PR pueda ser mergeado.

---

## Extensiones premium

Las extensiones premium de ScrumForge viven en un repositorio privado separado (`scrumforge-extensions`). Si contribuyes al núcleo del proyecto, **no necesitas acceder a ese repositorio**.

Si encuentras un bug que parece requerir cambios en una extensión premium, menciónalo en la descripción del PR y el equipo se encargará de coordinarlo.

---

## Licencia

Al enviar un Pull Request, aceptas que tus contribuciones al núcleo de ScrumForge quedan licenciadas bajo **AGPL-3.0**, la misma licencia del proyecto.
