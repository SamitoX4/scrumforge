/**
 * app.ts — Fábrica de la aplicación Express.
 *
 * Crea y configura la instancia de Express con todo el middleware necesario:
 * seguridad (Helmet, CORS), logging, rate limiting, autenticación OAuth,
 * manejo de webhooks Stripe y el endpoint GraphQL de Apollo Server.
 *
 * Se exporta como una función (`createApp`) para facilitar la inyección
 * del schema en tests y para separar la configuración del arranque
 * (que vive en `main.ts`).
 */

// src/app.ts
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import passport from "passport";
import { ApolloServer, HeaderMap } from "@apollo/server";
import type { GraphQLSchema } from "graphql";
import { executableSchema } from "./graphql/schema";
import { buildContext, GraphQLContext } from "./graphql/context";
import { formatError } from "./middleware/error-handler.middleware";
import {
  generalRateLimit,
  authRateLimit,
} from "./middleware/rate-limit.middleware";
import { httpsRedirectMiddleware } from "./middleware/https-redirect.middleware";
import { configurePassport } from "./config/passport";
import { signAccessToken, signRefreshToken } from "./utils/crypto.utils";
import { prisma } from "./config/db/prisma.client";
import { logger } from "./utils/logger";

/**
 * Crea y configura la aplicación Express completa.
 *
 * @param schema - Schema GraphQL ejecutable (core + extensiones). Si no se
 *   proporciona se usa el schema por defecto exportado desde `graphql/schema.ts`.
 *   En producción `main.ts` pasa el schema ya enriquecido con extensiones.
 * @returns Instancia de Express lista para ser adjuntada a un servidor HTTP.
 */
export async function createApp(schema: GraphQLSchema = executableSchema): Promise<Express> {
  const app = express();

  // ── HTTPS enforcement ─────────────────────────────────────────────────────
  // El comportamiento depende de HTTPS_MODE:
  //
  //  proxy      — El reverse proxy (Caddy, Nginx…) termina TLS y reenvía por HTTP
  //               interno con la cabecera X-Forwarded-Proto: https.
  //               'trust proxy' le dice a Express que confíe en esa cabecera;
  //               httpsRedirectMiddleware redirige (301) cualquier petición HTTP.
  //
  //  standalone — El propio backend levanta HTTPS directamente (main.ts usa
  //               https.createServer). No se necesita redirección aquí porque
  //               el servidor HTTPS ya rechaza conexiones HTTP en su puerto.
  //               Se configura trust proxy = false para no confiar en cabeceras
  //               externas que podrían falsificarse al no haber proxy de confianza.
  //
  //  off        — Sin enforcement. Útil en desarrollo local y en entornos de test
  //               donde TLS no es necesario. No se registra ningún middleware.
  const httpsMode = process.env.HTTPS_MODE ?? 'off';

  if (httpsMode === 'proxy') {
    // Confiar en el primer proxy de la cadena (X-Forwarded-Proto, X-Forwarded-For, etc.)
    // El valor numérico '1' indica exactamente un proxy de confianza.
    app.set('trust proxy', 1);
    app.use(httpsRedirectMiddleware);
  }

  // ── Health check (antes del rate limiter y demás middleware) ───────────────
  // Se registra aquí para que los health checks de Kubernetes/Docker no
  // consuman cuota de rate limiting y no aparezcan en los logs de peticiones.
  app.get('/health', async (_req, res) => {
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      // Consulta mínima para verificar la conectividad con la base de datos
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }
    // Devuelve 503 si la DB está caída para que el load balancer lo detecte
    const httpStatus = dbStatus === 'ok' ? 200 : 503;
    res.status(httpStatus).json({
      status: dbStatus === 'ok' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: dbStatus,
        graphql: 'ok',
      },
    });
  });

  // ── Cabeceras de seguridad HTTP (Helmet) ───────────────────────────────────
  // Helmet añade una serie de cabeceras HTTP recomendadas para mitigar
  // ataques comunes (clickjacking, MIME sniffing, XSS, etc.).
  app.use(helmet({
    // Desactivamos crossOriginEmbedderPolicy para que Apollo Studio/Sandbox
    // pueda cargar recursos cross-origin sin errores de COEP.
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-inline' y 'unsafe-eval' son necesarios para Apollo Sandbox
        // que inyecta scripts en línea en el panel de exploración.
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        // wss: y ws: permiten que Apollo Client establezca la conexión WebSocket
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }));

  // ── Cabecera X-Response-Time ───────────────────────────────────────────────
  // Mide el tiempo total de procesamiento de cada request e inyecta el valor
  // en la respuesta para facilitar el monitoreo de latencia.
  app.use((_req, res, next) => {
    const start = Date.now();
    const originalWriteHead = res.writeHead.bind(res);
    // Interceptamos writeHead (llamado justo antes de enviar la respuesta)
    // para inyectar el header con el tiempo transcurrido.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).writeHead = function (...args: Parameters<typeof res.writeHead>) {
      res.setHeader('X-Response-Time', `${Date.now() - start}ms`);
      return originalWriteHead(...args);
    };
    next();
  });

  // ── Logger de peticiones HTTP ──────────────────────────────────────────────
  // Excluimos /health para evitar contaminar los logs con miles de checks
  // silenciosos del orquestador de contenedores.
  app.use((req, _res, next) => {
    if (req.path !== '/health') {
      logger.info({ method: req.method, path: req.path, ip: req.ip }, 'HTTP request');
    }
    next();
  });

  // ── Stripe Webhook (DEBE ir antes de express.json()) ──────────────────────
  // Solo activo si la extensión billing-stripe está instalada en backend/extensions/
  // Stripe firma el body con HMAC-SHA256 — requiere el body RAW (Buffer).
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const { BillingService } = require('../../extensions/billing-stripe/billing.service') as any;
      const billingService = new BillingService(prisma);
      await billingService.handleWebhook(req.body as Buffer, sig);
      res.json({ received: true });
    } catch (err) {
      logger.error({ err }, 'Stripe webhook error');
      res.status(400).send(`Webhook Error: ${err}`);
    }
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  // En desarrollo se permiten todas las variantes de localhost (IPv4, IPv6,
  // cualquier puerto) para simplificar el trabajo local.
  // En producción solo se permite el origen declarado en FRONTEND_URL.
  const isDev = process.env.NODE_ENV !== "production";
  app.use(
    cors({
      origin: isDev
        ? (origin, callback) => {
            // Permitir en desarrollo: sin origen (curl, etc.), localhost, 127.0.0.1 (IPv4) y ::1 (IPv6)
            const allowedHosts = [
              /^https?:\/\/localhost(:\d+)?$/,
              /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
              /^https?:\/\/\[::1\](:\d+)?$/, // IPv6 localhost
            ];
            if (!origin || allowedHosts.some((regex) => regex.test(origin))) {
              callback(null, true);
            } else {
              callback(new Error(`CORS: origen no permitido — ${origin}`));
            }
          }
        : process.env.FRONTEND_URL,
      // credentials: true es necesario para que el navegador envíe cookies
      // y la cabecera Authorization en peticiones cross-origin.
      credentials: true,
    }),
  );

  // Parsea el body de las peticiones como JSON.
  // Debe estar después del webhook de Stripe que necesita el cuerpo crudo.
  app.use(express.json());

  // ── Rate limiting ──────────────────────────────────────────────────────────
  // Límite general: 200 req/min por IP
  app.use("/graphql", generalRateLimit);

  // Límite estricto para operaciones de auth: 20 req/15min por IP.
  // Se inspecciona el body para detectar operaciones de login/registro
  // sin necesidad de un endpoint REST separado.
  app.use("/graphql", (req, res, next) => {
    const body = req.body as
      | { operationName?: string; query?: string }
      | undefined;
    const op = body?.operationName?.toLowerCase() ?? "";
    const query = body?.query?.toLowerCase() ?? "";
    if (
      op.includes("login") ||
      op.includes("register") ||
      query.includes("login") ||
      query.includes("register")
    ) {
      // Aplica el rate limiter más estricto solo a estas operaciones
      authRateLimit(req, res, next);
    } else {
      next();
    }
  });

  // ── Google OAuth ────────────────────────────────────────────────────────────
  // Configura la estrategia de Passport con el cliente Prisma para poder
  // buscar/crear usuarios en la base de datos durante el flujo OAuth.
  configurePassport(prisma);
  app.use(passport.initialize());

  // Redirige al usuario a la pantalla de consentimiento de Google
  app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["email", "profile"], session: false }),
  );

  /**
   * Callback de Google OAuth — recibe el código de autorización de Google,
   * lo intercambia por un perfil de usuario (mediante Passport) y genera
   * los tokens JWT de ScrumForge para el cliente frontend.
   *
   * Si la autenticación falla, Passport redirige al frontend con un error.
   */
  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/login?error=oauth_failed` }),
    async (req, res) => {
      try {
        const user = req.user as { id: string; email: string; name: string; avatarUrl: string | null };

        // Generar los tokens JWT de acceso y refresco de ScrumForge
        const accessToken = signAccessToken({ userId: user.id, email: user.email });
        const refreshTokenValue = signRefreshToken({ userId: user.id, email: user.email });

        // Calcular la fecha de expiración del refresh token para guardarlo en DB
        const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";
        const days = parseInt(expiresIn.replace("d", ""), 10) || 30;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        // Persistir el refresh token en la base de datos para poder revocarlo
        await prisma.refreshToken.create({
          data: { token: refreshTokenValue, userId: user.id, expiresAt },
        });

        // Redirigir al frontend con los tokens como query params.
        // El frontend los captura en la página /auth/callback, los guarda
        // en el store de Zustand y redirige al dashboard.
        const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
        const params = new URLSearchParams({
          accessToken,
          refreshToken: refreshTokenValue,
          userId: user.id,
          name: user.name,
          email: user.email,
          ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
        });
        res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
      } catch (err) {
        logger.error({ err }, "Google OAuth callback error");
        const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
        res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      }
    },
  );

  // ── Apollo Server ──────────────────────────────────────────────────────────
  // introspection solo se habilita fuera de producción para evitar exponer
  // la estructura del schema a potenciales atacantes.
  const server = new ApolloServer<GraphQLContext>({
    schema,
    formatError,
    introspection: process.env.NODE_ENV !== "production",
  });

  await server.start();
  logger.info("Apollo Server iniciado");

  /**
   * Integración manual de Apollo Server v5 con Express.
   *
   * Apollo Server v5 eliminó la integración oficial con Express
   * (`@apollo/server/express4`). En su lugar se usa `executeHTTPGraphQLRequest`,
   * la API de bajo nivel, adaptando las cabeceras y el body del request de
   * Express al formato que Apollo espera.
   */
  app.use("/graphql", async (req, res) => {
    // Convertir las cabeceras de Express (objeto plano) al tipo HeaderMap de Apollo
    const headers = new HeaderMap();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        // Los headers con múltiples valores se unen con coma (estándar HTTP)
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
      httpGraphQLRequest: {
        method: req.method.toUpperCase(),
        headers,
        // Extraer la query string si existe (ej. para GET requests de introspección)
        search: req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '',
        body: req.body,
      },
      // buildContext extrae el JWT, resuelve el usuario y el workspace del tenant
      context: () => buildContext({ req }),
    });

    res.status(httpGraphQLResponse.status ?? 200);
    // Copiar las cabeceras de respuesta de Apollo a Express
    for (const [key, value] of httpGraphQLResponse.headers) {
      res.setHeader(key, value);
    }

    // Apollo puede devolver el body de dos maneras:
    // 'complete' — respuesta simple (string JSON), usada en queries/mutations
    // 'chunked' — respuesta incremental vía AsyncIterator, usada en @defer/@stream
    if (httpGraphQLResponse.body.kind === 'complete') {
      res.send(httpGraphQLResponse.body.string);
    } else {
      // Enviar los chunks del stream de respuesta incremental
      for await (const chunk of httpGraphQLResponse.body.asyncIterator) {
        res.write(chunk);
      }
      res.end();
    }
  });

  return app;
}
