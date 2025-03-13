/**
 * main.ts — Punto de entrada del servidor ScrumForge.
 *
 * Responsabilidades de este archivo:
 *  1. Validar variables de entorno antes de cualquier otra operación.
 *  2. Activar extensiones premium según `ENABLED_EXTENSIONS`.
 *  3. Registrar los handlers del bus de eventos (sprint, notificaciones).
 *  4. Iniciar el cron job de escalado de impedimentos.
 *  5. Construir el schema GraphQL fusionando core + extensiones.
 *  6. Levantar el servidor HTTP (Express + Apollo) y el servidor WebSocket.
 *  7. Registrar un graceful shutdown para señales SIGTERM / SIGINT.
 */

import 'dotenv/config';
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import { createServer as createHttpsServer } from 'https';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { validateEnv } from './config/env.validation';
import { createApp } from './app';
import { buildExecutableSchema } from './graphql/schema';
import { prisma } from './config/db/prisma.client';
import { pubsub } from './realtime/pubsub';
import { eventBus } from './events/event-bus';
import { verifyToken } from './utils/crypto.utils';
import { logger } from './utils/logger';
import { registerSprintHandlers } from './events/handlers/sprint.handler';
import { registerNotificationHandlers } from './events/handlers/notification.handler';
import { ImpedimentService } from './modules/impediment/impediment.service';
import { extensionRegistry } from './extensions/extension-registry';
import { loadExtensions } from './extensions/load-extensions';
import { loadTlsOptions } from './config/tls.config';
import type { AuthUser } from './graphql/context';

// Valida variables de entorno antes de arrancar — falla rápido si faltan
validateEnv();

/**
 * Compatibilidad con despliegues que aún no definen ENABLED_EXTENSIONS.
 * Si la variable no está presente en el entorno, se habilitan todas las
 * extensiones incluidas en el monorepo por defecto, de modo que no sea
 * necesario actualizar .env en instalaciones existentes.
 * Cuando ENABLED_EXTENSIONS sí está definida, su valor tiene precedencia total.
 */
if (process.env.ENABLED_EXTENSIONS === undefined) {
  const defaultExtensions = ['planning-poker', 'integrations', 'ai', 'retrospective-premium', 'advanced-reports', 'billing-stripe', 'wiki'];
  process.env.ENABLED_EXTENSIONS = defaultExtensions.join(',');
}

// Registra handlers del bus de eventos antes de levantar el servidor
// para garantizar que ningún evento se pierda durante el arranque.
registerSprintHandlers();
// El handler de notificaciones necesita acceso a la DB para crear registros.
registerNotificationHandlers(prisma);

/**
 * Cron: escala impedimentos OPEN sin actividad >2 días.
 * Se ejecuta cada 6 horas para no saturar la base de datos.
 * Los errores son no fatales — solo se registran como advertencia.
 */
const impedimentService = new ImpedimentService(prisma);
setInterval(() => {
  impedimentService.escalateStaleImpediments().catch((err) =>
    logger.warn({ err }, 'Error en cron de escalado de impedimentos'),
  );
}, 6 * 60 * 60 * 1000); // 6 horas en milisegundos

// Puerto configurable mediante PORT; por defecto 4000
const PORT = parseInt(process.env.PORT ?? '4000', 10);

/**
 * Función principal de arranque del servidor.
 * Es async porque varias operaciones de inicialización son asíncronas
 * (carga de extensiones, conexión a la DB, inicio de Apollo Server).
 */
async function bootstrap() {
  try {
    // ── Cargar extensiones externas (antes de construir el schema) ────────────
    // Las extensiones pueden añadir typedefs y resolvers al schema,
    // por lo que deben registrarse antes de que se construya.
    await loadExtensions();

    // ── Construir schema fusionando core + extensiones ────────────────────────
    // buildExecutableSchema recibe los typedefs y resolvers de todas las
    // extensiones registradas y los mezcla con los del core.
    const schema = buildExecutableSchema(
      extensionRegistry.getTypeDefs(),
      extensionRegistry.getResolvers(),
    );

    // Verificar que la conexión a la base de datos está operativa antes de
    // continuar. Un fallo aquí aborta el arranque con un error claro.
    await prisma.$connect();
    logger.info('Conexión a la base de datos establecida');

    // ── Inicializar extensiones con el contexto del servidor ──────────────────
    // Las extensiones pueden registrar handlers de eventos, arrancar jobs, etc.
    // Se hace aquí (después de $connect) para que tengan acceso a la DB.
    await extensionRegistry.initAll({ prisma, pubsub, eventBus });

    // Construir la aplicación Express con todo el middleware y Apollo Server
    const app = await createApp(schema);

    // ── Servidor principal (HTTP o HTTPS según HTTPS_MODE) ────────────────────
    // HTTPS_MODE controla si se levanta TLS directamente en el backend:
    //
    //  standalone — se crea un servidor HTTPS usando el cert/key de TLS_CERT_PATH
    //               y TLS_KEY_PATH. Además se levanta un servidor HTTP mínimo en
    //               HTTP_PORT (por defecto 80) que redirige todo a HTTPS.
    //               Útil cuando no hay reverse proxy (VPS, servidor bare-metal).
    //
    //  proxy / off — se crea un servidor HTTP estándar. El TLS lo gestiona el
    //               reverse proxy externo (Caddy, Nginx, AWS ALB) o no existe.
    const httpsMode = process.env.HTTPS_MODE ?? 'off';

    let httpServer: ReturnType<typeof createHttpServer> | ReturnType<typeof createHttpsServer>;

    if (httpsMode === 'standalone') {
      // Cargar certificado y clave privada desde las rutas configuradas
      const tlsOptions = loadTlsOptions();
      httpServer = createHttpsServer(tlsOptions, app);
      logger.info('Modo HTTPS standalone: servidor TLS activo');

      // Servidor HTTP auxiliar en HTTP_PORT para redirigir a HTTPS.
      // Recibe peticiones HTTP planas y responde con 301 → HTTPS.
      const httpPort = parseInt(process.env.HTTP_PORT ?? '80', 10);
      const redirectServer = createHttpServer(
        (req: IncomingMessage, res: ServerResponse) => {
          const host = req.headers.host ?? 'localhost';
          res.writeHead(301, { Location: `https://${host}${req.url ?? '/'}` });
          res.end();
        },
      );
      redirectServer.listen(httpPort, () => {
        logger.info(`Servidor HTTP → HTTPS redirect escuchando en el puerto ${httpPort}`);
      });
    } else {
      // Modo proxy u off: servidor HTTP estándar
      httpServer = createHttpServer(app);
    }

    // ── WebSocket server (graphql-ws) ─────────────────────────────────────────
    // Se monta en la misma ruta /graphql que el endpoint HTTP.
    // Apollo Client v4 usa el mismo endpoint para queries/mutations (HTTP)
    // y subscriptions (WS), diferenciados por el protocolo de la conexión.
    const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });

    /**
     * Registra el handler de graphql-ws que gestiona el protocolo
     * graphql-transport-ws sobre el servidor WebSocket.
     *
     * El contexto de cada conexión WS se construye extrayendo y verificando
     * el JWT enviado en `connectionParams.authorization`.
     * Si el token es inválido se establece `user: null` pero la conexión
     * no se rechaza, para permitir subscriptions a recursos públicos.
     */
    const wsServerCleanup = useServer(
      {
        schema,
        context: async (ctx) => {
          // El cliente pasa el token en los parámetros de conexión del protocolo WS
          const authHeader = ctx.connectionParams?.authorization as string | undefined;
          let user: AuthUser | null = null;

          if (authHeader?.startsWith('Bearer ')) {
            try {
              // Verificar y decodificar el JWT, luego buscar el usuario en la DB
              const payload = verifyToken(authHeader.slice(7));
              const dbUser = await prisma.user.findUnique({
                where: { id: payload.userId },
                // Solo seleccionar los campos necesarios para el contexto
                select: { id: true, email: true, name: true },
              });
              if (dbUser) user = dbUser;
            } catch {
              // Token inválido o expirado — la conexión continúa sin usuario autenticado
              logger.debug('WebSocket: token inválido en connectionParams');
            }
          }

          return { user, prisma };
        },
      },
      wsServer,
    );

    httpServer.listen(PORT, () => {
      const proto    = httpsMode === 'standalone' ? 'https' : 'http';
      const wsProto  = httpsMode === 'standalone' ? 'wss'   : 'ws';
      logger.info(`ScrumForge API en ${proto}://localhost:${PORT}/graphql`);
      logger.info(`WebSocket subscripciones en ${wsProto}://localhost:${PORT}/graphql`);
    });

    // ── Graceful shutdown ────────────────────────────────────────────────────
    /**
     * Cierra el servidor de forma ordenada cuando el proceso recibe una señal
     * de terminación (SIGTERM del orquestador, SIGINT por Ctrl+C en desarrollo).
     *
     * Orden de cierre:
     *  1. Servidor WebSocket — para que los clientes reciban el mensaje de cierre.
     *  2. Servidor HTTP — espera que las peticiones en vuelo terminen.
     *  3. Prisma / base de datos — libera el pool de conexiones.
     *
     * Si el proceso tarda más de 10 s se fuerza la salida para no bloquear
     * al orquestador de contenedores (Kubernetes, Docker Compose, etc.).
     */
    async function gracefulShutdown(signal: string) {
      logger.info({ signal }, 'Shutting down gracefully...');

      // Temporizador de seguridad: fuerza la salida si el cierre tarda demasiado
      const forceExitTimer = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
      // unref() evita que este timer mantenga el proceso vivo por sí solo
      forceExitTimer.unref();

      try {
        logger.info('Closing WebSocket server...');
        // dispose() envía el mensaje CLOSE del protocolo graphql-ws a los clientes
        await wsServerCleanup.dispose();

        logger.info('Closing HTTP server...');
        // httpServer.close() deja de aceptar nuevas conexiones pero espera
        // a que las activas terminen antes de llamar al callback
        await new Promise<void>((resolve, reject) =>
          httpServer.close((err) => (err ? reject(err) : resolve())),
        );

        logger.info('Disconnecting from database...');
        await prisma.$disconnect();

        clearTimeout(forceExitTimer);
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    }

    // Registrar los manejadores de señales del sistema operativo
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    // Error fatal durante el arranque — no tiene sentido continuar
    logger.error({ error }, 'Error al iniciar el servidor');
    process.exit(1);
  }
}

bootstrap();
