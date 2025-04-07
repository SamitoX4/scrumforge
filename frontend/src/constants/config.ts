/**
 * @fileoverview Configuración central de URLs del cliente de ScrumForge.
 *
 * Centraliza todas las URLs de conexión al backend para que los distintos
 * módulos (Apollo Client, subida de archivos, OAuth, etc.) obtengan sus
 * endpoints desde un único lugar. Así, cambiar el servidor en producción
 * solo requiere modificar las variables de entorno sin tocar el código.
 *
 * Las variables `VITE_*` son inyectadas por Vite en tiempo de compilación:
 * en desarrollo se leen del archivo `.env.local`; en producción se pasan
 * como `--build-arg` al proceso de build de Docker (ver Dockerfile del
 * frontend). Si no se definen, se usan los valores locales por defecto.
 *
 * @example Uso en otros módulos
 * ```ts
 * import { config } from '@/constants/config';
 * // En Apollo Client:
 * const httpLink = new HttpLink({ uri: config.graphqlUrl });
 * // En subida de archivos:
 * fetch(`${config.backendUrl}/upload`, { ... });
 * ```
 */

export const config = {
  /**
   * URL del endpoint GraphQL para queries y mutaciones (HTTP/HTTPS).
   * Usado por Apollo Client en el enlace HTTP para todas las operaciones
   * que no requieren conexión en tiempo real.
   *
   * @default 'http://localhost:4000/graphql'
   */
  graphqlUrl: import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:4000/graphql',

  /**
   * URL del endpoint WebSocket para subscripciones GraphQL (WS/WSS).
   * Usado por Apollo Client en el enlace WebSocket (graphql-ws) para
   * recibir eventos en tiempo real: notificaciones, actualizaciones del
   * tablero, mensajes de planning poker, etc.
   *
   * @default 'ws://localhost:4000/graphql'
   */
  wsUrl: import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000/graphql',

  /**
   * URL base del servidor backend (sin ruta específica).
   * Se usa para construir URLs de recursos no-GraphQL: subida de avatares,
   * redirecciones OAuth de Google, descarga de archivos adjuntos, etc.
   *
   * @default 'http://localhost:4000'
   */
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000',
} as const;
// `as const` convierte el objeto en de solo lectura (readonly) en TypeScript,
// evitando que ningún módulo pueda mutar accidentalmente la configuración
// y garantizando que los tipos de las propiedades sean literales exactos.
