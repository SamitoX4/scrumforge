/**
 * @file error.utils.ts
 * @description Jerarquía de errores de la aplicación y utilidad de conversión
 * a {@link GraphQLError}. Centraliza la gestión de errores del dominio para
 * que todos los resolvers lancen y capturen errores de forma consistente.
 *
 * Jerarquía:
 *   AppError (base)
 *   ├── NotFoundError       (404)
 *   ├── UnauthorizedError   (401)
 *   ├── ForbiddenError      (403)
 *   ├── ValidationError     (400)
 *   └── ConflictError       (409)
 */

import { GraphQLError } from 'graphql';

/**
 * Error base de la aplicación. Extiende `Error` añadiendo un código semántico
 * y un código de estado HTTP para que los resolvers y la capa de transporte
 * puedan reaccionar de forma diferenciada.
 */
export class AppError extends Error {
  /**
   * @param message    - Mensaje legible por el usuario final.
   * @param code       - Código de error en formato SCREAMING_SNAKE_CASE (ej. 'NOT_FOUND').
   * @param statusCode - Código de estado HTTP equivalente (por defecto 400).
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Error lanzado cuando un recurso solicitado no existe en la base de datos.
 * Equivale a HTTP 404.
 */
export class NotFoundError extends AppError {
  /**
   * @param resource - Nombre del recurso no encontrado (ej. 'Sprint', 'Proyecto').
   */
  constructor(resource: string) {
    super(`${resource} no encontrado`, 'NOT_FOUND', 404);
  }
}

/**
 * Error lanzado cuando una petición llega sin credenciales válidas.
 * Equivale a HTTP 401. Diferente de {@link ForbiddenError} (usuario autenticado
 * pero sin permisos).
 */
export class UnauthorizedError extends AppError {
  /**
   * @param message - Mensaje opcional; por defecto 'No autenticado'.
   */
  constructor(message = 'No autenticado') {
    super(message, 'UNAUTHENTICATED', 401);
  }
}

/**
 * Error lanzado cuando el usuario está autenticado pero no tiene permisos
 * para realizar la operación solicitada.
 * Equivale a HTTP 403.
 */
export class ForbiddenError extends AppError {
  /**
   * @param message - Mensaje opcional con descripción del permiso requerido.
   */
  constructor(message = 'No tienes permisos para realizar esta acción') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Error lanzado cuando los datos de entrada no cumplen las reglas de negocio
 * o las restricciones de formato esperadas.
 * Equivale a HTTP 400.
 */
export class ValidationError extends AppError {
  /**
   * @param message - Descripción del campo o regla que falló la validación.
   */
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

/**
 * Error lanzado cuando la operación entraría en conflicto con el estado actual
 * de los datos (ej. nombre duplicado, transición de estado inválida).
 * Equivale a HTTP 409.
 */
export class ConflictError extends AppError {
  /**
   * @param message - Descripción del conflicto detectado.
   */
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * Convierte cualquier tipo de error en un {@link GraphQLError} con extensiones
 * estándar (`code` y `statusCode`) que Apollo Server puede serializar correctamente.
 *
 * Lógica de conversión:
 *   - `AppError`  → preserva el código semántico y el statusCode del dominio.
 *   - `Error`     → código genérico `INTERNAL_SERVER_ERROR` con statusCode 500.
 *   - Otros       → mensaje genérico con `INTERNAL_SERVER_ERROR`.
 *
 * @param error - Valor lanzado en un bloque catch (puede ser cualquier tipo).
 * @returns {@link GraphQLError} listo para ser relanzado desde un resolver.
 */
export function toGraphQLError(error: unknown): GraphQLError {
  if (error instanceof AppError) {
    // Propaga el código y estado HTTP del error de dominio como extensiones GraphQL
    return new GraphQLError(error.message, {
      extensions: { code: error.code, statusCode: error.statusCode },
    });
  }
  if (error instanceof Error) {
    // Error nativo de JS: oculta detalles internos, solo expone el mensaje
    return new GraphQLError(error.message, {
      extensions: { code: 'INTERNAL_SERVER_ERROR', statusCode: 500 },
    });
  }
  // Valor no-Error lanzado (string, objeto, etc.): respuesta genérica segura
  return new GraphQLError('Error interno del servidor', {
    extensions: { code: 'INTERNAL_SERVER_ERROR', statusCode: 500 },
  });
}
