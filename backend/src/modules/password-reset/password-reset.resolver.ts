/**
 * @file password-reset.resolver.ts
 * @module password-reset
 * @description Resolvers de GraphQL para el flujo de restablecimiento de contraseña.
 *
 * Implementa dos mutaciones públicas (no requieren sesión):
 * - `forgotPassword`: recibe el email del usuario y le envía un enlace
 *   de restablecimiento por correo. Siempre retorna `true` por seguridad,
 *   incluso si el email no existe, para no revelar qué cuentas están registradas.
 * - `resetPassword`: recibe el token del enlace y la nueva contraseña,
 *   actualiza el hash y marca el token como usado.
 *
 * Ambas operaciones son públicas porque el usuario aún no ha iniciado sesión.
 */

import { GraphQLContext } from '../../graphql/context';
import { PasswordResetService } from './password-reset.service';

/**
 * Mapa de resolvers para el módulo de restablecimiento de contraseña.
 */
export const passwordResetResolvers = {
  Mutation: {
    /**
     * Inicia el flujo de restablecimiento de contraseña para un email dado.
     * Por razones de seguridad (enumeración de usuarios), siempre retorna
     * `true` independientemente de si el email existe o no.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param email - Dirección de correo del usuario que olvidó su contraseña.
     * @param prisma - Cliente Prisma del contexto.
     * @returns Siempre `true` para no revelar si el email está registrado.
     */
    async forgotPassword(
      _: unknown,
      { email }: { email: string },
      { prisma }: GraphQLContext,
    ): Promise<boolean> {
      const service = new PasswordResetService(prisma);
      return service.forgotPassword(email);
    },

    /**
     * Completa el restablecimiento de contraseña usando el token del enlace
     * enviado por email y establece la nueva contraseña.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param token - Token de restablecimiento recibido por email.
     * @param newPassword - Nueva contraseña elegida por el usuario (en texto plano;
     *                      el servicio se encarga de hacer el hash).
     * @param prisma - Cliente Prisma del contexto.
     * @returns `true` si el restablecimiento fue exitoso.
     * @throws ValidationError si el token es inválido, ya fue usado o expiró.
     */
    async resetPassword(
      _: unknown,
      { token, newPassword }: { token: string; newPassword: string },
      { prisma }: GraphQLContext,
    ): Promise<boolean> {
      const service = new PasswordResetService(prisma);
      return service.resetPassword(token, newPassword);
    },
  },
};
