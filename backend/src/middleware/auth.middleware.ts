/**
 * auth.middleware.ts — Helper de autorización para resolvers GraphQL.
 *
 * Proporciona la función `requireAuth` que los resolvers deben llamar al inicio
 * para garantizar que la petición viene de un usuario autenticado.
 *
 * Por qué usar una función en lugar de confiar solo en la directiva @auth:
 *  - La directiva @auth se aplica en el nivel del campo (SDL), ideal para
 *    proteger queries/mutations completas de forma declarativa.
 *  - `requireAuth` se usa dentro del cuerpo del resolver cuando la lógica
 *    de autorización es más compleja (ej. verificar ownership del recurso)
 *    y necesita acceder al `context.user` con tipo garantizado.
 *  - La aserción de tipo TypeScript (`asserts`) permite que el compilador
 *    infiera `context.user` como no-null después de llamar a `requireAuth`.
 *
 * Ejemplo de uso en un resolver:
 * ```ts
 * async myResolver(_: unknown, args: Args, ctx: GraphQLContext) {
 *   requireAuth(ctx); // Lanza si ctx.user es null; afina el tipo si pasa
 *   const userId = ctx.user.id; // TypeScript sabe que user no es null aquí
 * }
 * ```
 */

import { GraphQLContext } from '../graphql/context';
import { UnauthorizedError } from '../utils/error.utils';

/**
 * Verifica que el contexto GraphQL contiene un usuario autenticado.
 *
 * Usa una "assertion function" de TypeScript que le comunica al compilador
 * que, si la función retorna sin lanzar, `context.user` es no-null. Esto
 * permite usar `context.user.id`, `context.user.email`, etc. directamente
 * después de llamar a `requireAuth` sin comprobaciones adicionales de nulidad.
 *
 * @param context - Contexto GraphQL de la petición actual.
 * @throws {UnauthorizedError} Si no hay usuario autenticado en el contexto.
 */
export function requireAuth(context: GraphQLContext): asserts context is GraphQLContext & { user: NonNullable<GraphQLContext['user']> } {
  if (!context.user) {
    throw new UnauthorizedError();
  }
}
