# Política de seguridad de ScrumForge

Este documento describe la política de seguridad del proyecto ScrumForge, cómo reportar vulnerabilidades de forma responsable y las medidas de seguridad implementadas en el sistema.

---

## Versiones soportadas

Solo la rama de desarrollo activa recibe actualizaciones de seguridad:

| Versión | Soporte de seguridad |
|---------|---------------------|
| 1.x (actual) | ✅ Activo |
| < 1.0 | ❌ Sin soporte |

---

## Reportar una vulnerabilidad

> **IMPORTANTE**: No abras un issue público en GitHub para reportar vulnerabilidades de seguridad. Esto podría exponer el problema antes de que esté disponible un parche.

Para reportar una vulnerabilidad, envía un correo a:

**security@scrumforge.dev**

### Qué incluir en el reporte

- Descripción detallada de la vulnerabilidad
- Pasos para reproducirla
- Impacto potencial estimado
- Corrección sugerida (si la tienes)

### Tiempos de respuesta

- **Acuse de recibo**: en un plazo máximo de **48 horas**.
- **Corrección de problemas críticos**: en un plazo máximo de **30 días** desde la confirmación.

### Divulgación responsable

Pedimos un periodo de **90 días** desde la notificación antes de la divulgación pública, para permitir que el equipo desarrolle y publique un parche. Si necesitas un plazo diferente, indícalo en tu reporte y lo negociaremos.

---

## Medidas de seguridad implementadas

A continuación se presenta un resumen de las principales medidas de seguridad activas en ScrumForge. Para una descripción completa y detallada, consulta [doc/SECURITY_PLAN.md](./doc/SECURITY_PLAN.md).

- **Rate limiting**: 200 req/min con alcance general; 20 req/15 min para endpoints de autenticación. Implementado con Redis o Map en memoria como fallback.
- **Helmet**: cabeceras de seguridad HTTP configuradas (CSP, HSTS, X-Frame-Options y otras).
- **CORS**: restringido a `FRONTEND_URL` en entornos de producción.
- **JWT**: access token de corta duración complementado con refresh token con rotación automática.
- **Hashing de contraseñas**: bcrypt con salt rounds configurables.
- **Política de contraseñas**: mínimo 8 caracteres, letra mayúscula, letra minúscula y dígito.
- **Anti-enumeración de emails**: el flujo de recuperación de contraseña no revela si un email existe en el sistema.
- **Verificación HMAC de webhooks**: los webhooks de Stripe son verificados con firma HMAC.
- **Cifrado de API keys**: las API keys de Anthropic se almacenan cifradas en base de datos.
- **Introspección GraphQL deshabilitada** en producción.
- **RBAC**: control de acceso basado en roles en todos los resolvers de GraphQL.
- **Audit log**: registro de operaciones sensibles y destructivas.
- **Sanitización de logs**: Pino configurado con `redact` para eliminar automáticamente contraseñas, tokens y API keys de los logs.
- **HTTPS configurable**: modo proxy (cabecera `X-Forwarded-Proto`) o TLS directo (standalone).
- **npm audit en CI**: el pipeline falla si se detectan vulnerabilidades HIGH o CRITICAL en dependencias de producción.
- **Dependabot**: activado para actualizaciones automáticas de dependencias.

---

## Alcance

Los siguientes ámbitos están **dentro del alcance** para reportes de vulnerabilidades:

- Autenticación y autorización
- Inyección (SQL, GraphQL, NoSQL, etc.)
- Cross-Site Scripting (XSS) y Cross-Site Request Forgery (CSRF)
- Exposición de datos sensibles
- Lógica de negocio relacionada con billing y gestión de planes
- Escalado de privilegios entre workspaces (aislamiento multi-tenant)

---

## Fuera de alcance

Los siguientes casos están **fuera del alcance** y no serán tratados como vulnerabilidades:

- Ataques de denegación de servicio (DoS/DDoS)
- Ingeniería social (*social engineering*)
- Vulnerabilidades en dependencias de terceros ya conocidas y sin parche disponible en el momento del reporte
- Instancias self-hosted no mantenidas por el equipo de ScrumForge

---

## Créditos

Reconocemos públicamente a los investigadores de seguridad que reporten vulnerabilidades de forma responsable, con su permiso explícito. Si deseas aparecer en los créditos del parche o en el changelog, indícalo en tu reporte.
