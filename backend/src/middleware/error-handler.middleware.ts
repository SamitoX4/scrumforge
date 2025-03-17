/**
 * error-handler.middleware.ts — Formateador de errores GraphQL para Apollo Server.
 *
 * Apollo Server llama a `formatError` por cada error que aparece en la respuesta
 * antes de serializar el JSON. Esta función centraliza:
 *
 *  1. La clasificación de errores (errores de dominio AppError vs errores inesperados).
 *  2. El enriquecimiento de la respuesta con el `code` y `statusCode` correctos.
 *  3. El logging diferenciado: solo los errores 5xx se loguean como error;
 *     los 4xx son errores esperados del cliente y solo se loguean en debug.
 *  4. El oscurecimiento de detalles internos en producción para no exponer
 *     stack traces ni información sensible a los clientes.
 */

import { GraphQLFormattedError } from 'graphql';
import { AppError } from '../utils/error.utils';
import { logger } from '../utils/logger';

/**
 * Formatea un error GraphQL antes de incluirlo en la respuesta al cliente.
 *
 * Apollo Server v4+ envuelve los errores originales en un `GraphQLError`.
 * Esta función desenvuelve el error original para acceder a sus propiedades
 * (`code`, `statusCode`) y enriquecer la respuesta con ellas.
 *
 * Comportamiento según el tipo de error:
 *  - `AppError` (y subclases): se usa el `code` y `statusCode` del error.
 *    El mensaje se pasa tal cual al cliente (son mensajes controlados).
 *  - Errores genéricos de JavaScript: se devuelve el mensaje de error en
 *    desarrollo, pero en producción se oscurece con un mensaje genérico.
 *
 * @param formattedError - Error ya formateado por Apollo con location/path.
 * @param error          - Error original lanzado en el resolver.
 * @returns Error formateado listo para incluir en la respuesta GraphQL.
 */
export function formatError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  // Apollo envuelve el error del resolver en un GraphQLError con la propiedad
  // `originalError`. Desenvolver para acceder al AppError original si existe.
  const originalError =
    (error as { originalError?: unknown })?.originalError ?? error;
  const isAppError = originalError instanceof AppError;

  // Extraer el código de estado HTTP del error original para usarlo en logging
  // y para decidir si oscurecer la respuesta en producción.
  const statusCode = isAppError
    ? originalError.statusCode
    : ((formattedError.extensions?.statusCode as number) ?? 500);

  // Solo loguear como error los fallos del servidor (5xx).
  // Los errores del cliente (4xx: validación, auth, not found) son esperados
  // y añadirían ruido innecesario a los logs de producción.
  if (statusCode >= 500) {
    logger.error({ error, formattedError }, 'GraphQL server error');
  }

  // Enriquecer las extensions con el code y statusCode del AppError original.
  // Esto permite al cliente frontend discriminar el tipo de error sin parsear
  // el mensaje (que puede variar) y mostrar mensajes de error apropiados.
  const enriched: GraphQLFormattedError = isAppError
    ? {
        ...formattedError,
        extensions: {
          ...formattedError.extensions,
          code: originalError.code,         // ej: 'NOT_FOUND', 'UNAUTHENTICATED'
          statusCode: originalError.statusCode, // ej: 404, 401
        },
      }
    : formattedError;

  // En producción, oscurecer los detalles de errores internos (5xx) para evitar
  // exponer stack traces, mensajes de DB u otra información sensible al cliente.
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    return {
      message: 'Error interno del servidor',
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    };
  }

  return enriched;
}
