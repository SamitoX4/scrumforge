/**
 * auth.directive.ts — Implementación de las directivas @auth y @hasRole.
 *
 * Las directivas GraphQL son una forma declarativa de aplicar lógica de
 * autorización directamente en el schema SDL, sin necesidad de repetir
 * comprobaciones en cada resolver individual.
 *
 * Directivas disponibles:
 *
 *   @auth
 *     Requiere que haya un usuario autenticado en el contexto. Si `ctx.user`
 *     es `null`, lanza `UnauthorizedError` (HTTP 401).
 *     Uso: `me: User @auth`
 *
 *   @hasRole(role: String!)
 *     Requiere autenticación Y que el usuario tenga un rol >= al indicado
 *     en el proyecto referenciado por `args.projectId` o `args.id`.
 *     La jerarquía de roles es: STAKEHOLDER < DEVELOPER < SCRUM_MASTER < PRODUCT_OWNER.
 *     Si el usuario no tiene el nivel requerido, lanza `ForbiddenError` (HTTP 403).
 *     Uso: `deleteProject(id: ID!): Boolean @hasRole(role: "PRODUCT_OWNER")`
 *
 * Implementación:
 *   `applyAuthDirectives` usa `mapSchema` de `@graphql-tools/utils` para
 *   recorrer todos los campos del schema y sustituir sus resolvers por
 *   wrappers que ejecutan la comprobación de autorización antes de delegar
 *   al resolver original.
 */

import { MapperKind, getDirective, mapSchema } from '@graphql-tools/utils';
import { GraphQLSchema, defaultFieldResolver } from 'graphql';
import { UnauthorizedError, ForbiddenError } from '../../utils/error.utils';
import type { GraphQLContext } from '../context';

/**
 * Jerarquía numérica de roles para comparación ordinal.
 * Un nivel mayor implica más permisos (los roles superiores incluyen
 * los permisos de los inferiores en la directiva @hasRole).
 */
const ROLE_HIERARCHY: Record<string, number> = {
  STAKEHOLDER: 1,
  DEVELOPER: 2,
  SCRUM_MASTER: 3,
  PRODUCT_OWNER: 4,
};

/**
 * Aplica las directivas `@auth` y `@hasRole` al schema ejecutable.
 *
 * Recorre todos los campos de tipo objeto del schema. Por cada campo que
 * tenga alguna de las directivas, sustituye su resolver por un wrapper
 * que comprueba la autorización antes de ejecutar el resolver original.
 *
 * Los campos sin directivas de autorización no se modifican.
 *
 * @param schema - Schema GraphQL ejecutable ya construido con `makeExecutableSchema`.
 * @returns Nuevo schema con los resolvers envueltos para aplicar la autorización.
 */
export function applyAuthDirectives(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    // MapperKind.OBJECT_FIELD recorre TODOS los campos de todos los tipos
    // objeto (Query, Mutation, Subscription y tipos personalizados).
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      // ── @auth ────────────────────────────────────────────────────────────
      // getDirective devuelve un array de directivas del mismo nombre; tomamos
      // solo la primera [0] ya que no tiene sentido aplicar @auth dos veces.
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0];
      if (authDirective) {
        // Preservar el resolver original; si no tiene uno definido, usar el
        // defaultFieldResolver que accede a `source[fieldName]`.
        const { resolve = defaultFieldResolver } = fieldConfig;
        return {
          ...fieldConfig,
          resolve(source, args, context: GraphQLContext, info) {
            // Lanzar antes de llamar al resolver original para corto-circuitar
            if (!context.user) throw new UnauthorizedError();
            return resolve(source, args, context, info);
          },
        };
      }

      // ── @hasRole ─────────────────────────────────────────────────────────
      const hasRoleDirective = getDirective(schema, fieldConfig, 'hasRole')?.[0];
      if (hasRoleDirective) {
        const requiredRole = hasRoleDirective['role'] as string;
        const { resolve = defaultFieldResolver } = fieldConfig;
        return {
          ...fieldConfig,
          async resolve(source, args, context: GraphQLContext, info) {
            // Primero verificar autenticación básica antes de consultar la DB
            if (!context.user) throw new UnauthorizedError();

            // El projectId puede venir como `projectId` (en queries de proyecto)
            // o como `id` (en mutations que reciben el ID del recurso directamente).
            const projectId = args.projectId ?? args.id ?? null;
            if (projectId) {
              // Buscar el rol del usuario en el equipo del proyecto.
              // Se usa findFirst en lugar de findUnique porque un usuario puede
              // pertenecer a varios equipos pero en distintos proyectos.
              const member = await context.prisma.teamMember.findFirst({
                where: {
                  userId: context.user.id,
                  team: { projects: { some: { id: projectId } } },
                },
                select: { role: true },
              });

              // Comparar niveles numéricos: el usuario necesita nivel >= requerido
              const userLevel = ROLE_HIERARCHY[member?.role ?? ''] ?? 0;
              const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

              if (userLevel < requiredLevel) {
                throw new ForbiddenError(
                  `Se requiere rol ${requiredRole} o superior para esta operación`,
                );
              }
            }

            return resolve(source, args, context, info);
          },
        };
      }

      // Campo sin directivas de autorización — devolver sin modificar
      return fieldConfig;
    },
  });
}

/**
 * SDL de declaración de las directivas.
 * Debe incluirse en los typedefs del schema para que Apollo/GraphQL
 * reconozca `@auth` y `@hasRole` como directivas válidas al parsear los
 * typedefs de los módulos.
 */
export const authDirectiveTypeDefs = `
  directive @auth on FIELD_DEFINITION
  directive @hasRole(role: String!) on FIELD_DEFINITION
`;
