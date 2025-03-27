/**
 * @file user.resolver.ts
 * @description Resolvers GraphQL del módulo de usuarios.
 *
 * Cada resolver construye su propio `UserService` a través de `makeService`
 * para garantizar aislamiento por petición. La mayoría de resolvers exigen
 * autenticación; la query `me` devuelve `null` en lugar de error si no hay
 * sesión activa, lo que facilita el uso desde componentes de la UI que
 * verifican si el usuario está logueado.
 *
 * El campo `User.emailVerified` es un campo derivado que transforma la fecha
 * `emailVerifiedAt` en un booleano para simplificar el consumo por el cliente.
 */
import { GraphQLContext } from '../../graphql/context';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Factoría que construye un `UserService` listo para usar con el contexto
 * de la petición actual. Combina repositorio y cliente Prisma en una sola llamada.
 *
 * @param context - Contexto GraphQL de Apollo con el cliente Prisma y el usuario autenticado.
 * @returns Instancia de `UserService` configurada para esta petición.
 */
function makeService(context: GraphQLContext): UserService {
  return new UserService(new UserRepository(context.prisma), context.prisma);
}

export const userResolvers = {
  Query: {
    /**
     * Devuelve el perfil del usuario autenticado.
     * A diferencia de otros resolvers, no lanza error si no hay sesión:
     * devuelve `null` para que el frontend pueda usarlo como comprobación de login.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param __ - Sin argumentos.
     * @param context - Contexto GraphQL (puede no tener usuario).
     */
    async me(_: unknown, __: unknown, context: GraphQLContext) {
      // Devolver null en lugar de lanzar UnauthorizedError para uso en comprobación de sesión
      if (!context.user) return null;
      return makeService(context).getProfile(context.user.id);
    },

    /**
     * Exporta todos los datos del usuario autenticado como JSON (cumplimiento RGPD).
     * Incluye perfil, membresías, historias asignadas, tareas, comentarios y notificaciones.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param __ - Sin argumentos.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async exportMyData(_: unknown, __: unknown, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).exportMyData(context.user.id);
    },

    /**
     * Devuelve si el usuario autenticado tiene una API key de Anthropic guardada.
     * No expone la key en sí; solo confirma su existencia para que la UI
     * pueda mostrar el estado correcto del formulario de configuración de IA.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param __ - Sin argumentos.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async hasAnthropicApiKey(_: unknown, __: unknown, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).hasAnthropicApiKey(context.user.id);
    },
  },

  Mutation: {
    /**
     * Actualiza el nombre y/o la URL del avatar del usuario autenticado.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param name      - Nuevo nombre visible (opcional).
     * @param avatarUrl - Nueva URL del avatar (opcional).
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async updateProfile(
      _: unknown,
      { name, avatarUrl }: { name?: string; avatarUrl?: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).updateProfile(context.user.id, { name, avatarUrl });
    },

    /**
     * Elimina la cuenta del usuario autenticado de forma irreversible.
     * Requiere la contraseña actual para confirmar la intención.
     * Los datos personales se anonimizan en lugar de borrarse para preservar
     * la integridad de los registros históricos (comentarios, tareas, etc.).
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param password - Contraseña actual del usuario para confirmar la eliminación.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async deleteAccount(
      _: unknown,
      { password }: { password: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).deleteAccount(context.user.id, password);
    },

    /**
     * Guarda o sobreescribe la API key personal de Anthropic del usuario.
     * Se almacena cifrada en BD y nunca se devuelve por GraphQL.
     * Permite a cada usuario usar su propia cuota de IA sin depender de la clave global.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param key - API key de Anthropic a guardar.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async saveAnthropicApiKey(
      _: unknown,
      { key }: { key: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).saveAnthropicApiKey(context.user.id, key);
    },

    /**
     * Elimina la API key personal de Anthropic del usuario.
     * Tras la eliminación, las features de IA del usuario utilizarán
     * la clave global del servidor (si existe).
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param __ - Sin argumentos.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async deleteAnthropicApiKey(_: unknown, __: unknown, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).deleteAnthropicApiKey(context.user.id);
    },
  },

  User: {
    /**
     * Campo derivado que transforma `emailVerifiedAt` (fecha o null) en un booleano.
     * Simplifica el consumo en el cliente: no hay que comparar con null explícitamente.
     *
     * @param parent - Objeto User con el campo `emailVerifiedAt`.
     * @returns `true` si el correo ha sido verificado, `false` en caso contrario.
     */
    emailVerified: (parent: { emailVerifiedAt?: Date | null }) =>
      parent.emailVerifiedAt != null,
  },
};
