/**
 * date.scalar.ts — Escalar GraphQL `DateTime`.
 *
 * GraphQL no incluye un tipo de fecha/hora nativo. Este escalar personalizado
 * serializa fechas como strings ISO 8601 (ej. "2026-03-06T12:00:00.000Z"),
 * que es el formato que Prisma devuelve y que Apollo Client espera recibir.
 *
 * Tres operaciones del ciclo de vida de un escalar:
 *  - `serialize`:    convierte el valor de la DB → string JSON en la respuesta.
 *  - `parseValue`:   convierte el string de la variable GraphQL → Date para Prisma.
 *  - `parseLiteral`: convierte el literal del SDL (inline en la query) → Date.
 *
 * Uso en typedefs: `createdAt: DateTime`
 */

import { GraphQLScalarType, Kind } from 'graphql';

/**
 * Implementación del escalar DateTime.
 *
 * Compatible con:
 *  - Objetos `Date` de JavaScript (lo que Prisma devuelve en campos DateTime).
 *  - Strings ISO 8601 (lo que Apollo Client envía en variables).
 *  - Números UNIX timestamp en milisegundos (para interoperabilidad).
 */
export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'Fecha y hora en formato ISO 8601 (ej: "2026-03-06T12:00:00.000Z")',

  /**
   * Serialización: convierte el valor del resolver → string en la respuesta JSON.
   * Se llama cuando el campo aparece en la respuesta de una query.
   * Prisma devuelve `Date`, pero también podría llegar un string o número.
   */
  serialize(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();
    if (typeof value === 'number') return new Date(value).toISOString();
    throw new TypeError(`DateTime no puede serializar el valor: ${JSON.stringify(value)}`);
  },

  /**
   * Parseo de variable: convierte el valor de variables GraphQL → Date para Prisma.
   * Se llama cuando el campo es un argumento de entrada pasado como variable
   * (ej. `query($date: DateTime!) { ... }`).
   */
  parseValue(value: unknown): Date {
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      // Verificar que la fecha es válida — `new Date('invalid')` devuelve NaN
      if (isNaN(date.getTime())) throw new TypeError(`DateTime recibió una fecha inválida: ${value}`);
      return date;
    }
    throw new TypeError(`DateTime esperaba string o number, recibió: ${typeof value}`);
  },

  /**
   * Parseo de literal SDL: convierte un valor inline en la query → Date.
   * Se llama cuando el valor se escribe directamente en el documento GraphQL
   * (ej. `query { events(from: "2026-01-01") }` sin usar variables).
   * Solo se admite StringValue ya que las fechas se representan como strings ISO.
   */
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (isNaN(date.getTime())) throw new TypeError(`DateTime SDL inválido: ${ast.value}`);
      return date;
    }
    throw new TypeError(`DateTime espera un StringValue en SDL`);
  },
});

/** Typedef SDL para registrar el escalar en el schema. */
export const dateScalarTypeDefs = `#graphql
  scalar DateTime
`;

/** Mapa de resolvers del escalar, para fusionar con los resolvers del schema. */
export const dateScalarResolvers = {
  DateTime: DateTimeScalar,
};
