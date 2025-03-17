/**
 * @file auth.resolver.ts
 * @description Resolvers GraphQL del módulo de autenticación.
 *
 * Cada resolver construye su propio `AuthService` con la instancia de Prisma
 * que llega por contexto. Esto es intencional: el servicio no se comparte entre
 * peticiones para evitar contaminación de estado en entornos concurrentes.
 *
 * Todos los resolvers de este módulo son públicos (no requieren `requireAuth`)
 * porque son precisamente las mutaciones que permiten obtener un token.
 */
import { AuthService } from './auth.service';
import { GraphQLContext } from '../../graphql/context';

export const authResolvers = {
  Mutation: {
    /**
     * Registra un nuevo usuario en el sistema.
     * Dispara el envío del correo de verificación de forma asíncrona
     * para no bloquear la respuesta al cliente.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param input - Nombre, email y contraseña del nuevo usuario.
     * @param prisma - Cliente Prisma inyectado por el contexto de Apollo.
     * @returns Par de tokens JWT y datos del usuario creado.
     */
    async register(
      _: unknown,
      { input }: { input: { name: string; email: string; password: string } },
      { prisma }: GraphQLContext,
    ) {
      const service = new AuthService(prisma);
      return service.register(input);
    },

    /**
     * Autentica a un usuario con email y contraseña.
     * Aplica bloqueo de cuenta tras múltiples intentos fallidos para
     * mitigar ataques de fuerza bruta.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param input - Email y contraseña del usuario.
     * @param prisma - Cliente Prisma inyectado por el contexto de Apollo.
     * @returns Par de tokens JWT y datos del usuario autenticado.
     */
    async login(
      _: unknown,
      { input }: { input: { email: string; password: string } },
      { prisma }: GraphQLContext,
    ) {
      const service = new AuthService(prisma);
      return service.login(input);
    },

    /**
     * Rota el par de tokens usando el refresh token actual.
     * El token presentado se elimina de la BD y se emite uno nuevo,
     * por lo que cada token sólo puede usarse una vez (rotación).
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param refreshToken - Token de refresco vigente del cliente.
     * @param prisma - Cliente Prisma inyectado por el contexto de Apollo.
     * @returns Nuevo par de tokens JWT.
     */
    async refreshTokens(
      _: unknown,
      { refreshToken }: { refreshToken: string },
      { prisma }: GraphQLContext,
    ) {
      const service = new AuthService(prisma);
      return service.refreshTokens(refreshToken);
    },

    /**
     * Cierra la sesión del cliente invalidando su refresh token en la BD.
     * Se usa el refresh token (no el access token) porque el access token
     * no se almacena en servidor y no se puede revocar directamente.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param refreshToken - Token de refresco a invalidar.
     * @param prisma - Cliente Prisma inyectado por el contexto de Apollo.
     * @returns `true` siempre, incluso si el token no existía.
     */
    async logout(
      _: unknown,
      { refreshToken }: { refreshToken: string },
      { prisma }: GraphQLContext,
    ) {
      const service = new AuthService(prisma);
      return service.logout(refreshToken);
    },
  },
};
