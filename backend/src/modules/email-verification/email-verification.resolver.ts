/**
 * @file email-verification.resolver.ts
 * @module email-verification
 * @description Resolvers de GraphQL para la verificación de correo electrónico.
 *
 * Expone dos mutaciones:
 * - `sendVerificationEmail`: envía un email con el enlace de verificación
 *   al usuario actualmente autenticado.
 * - `verifyEmail`: valida un token de verificación y marca el email
 *   del usuario como verificado en la base de datos.
 *
 * La primera mutación requiere sesión activa; la segunda es pública
 * porque se invoca desde el enlace del correo antes de autenticarse.
 */

import { GraphQLContext } from '../../graphql/context';
import { UnauthorizedError } from '../../utils/error.utils';
import { EmailVerificationService } from './email-verification.service';

/**
 * Mapa de resolvers para el módulo de verificación de email.
 */
export const emailVerificationResolvers = {
  Mutation: {
    /**
     * Envía un correo electrónico de verificación al usuario autenticado.
     * Primero invalida cualquier token previo sin usar para evitar tokens
     * huérfanos, luego genera uno nuevo y lo envía por email.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param __ - Argumentos de la mutación; no hay ninguno.
     * @param user - Usuario autenticado extraído del contexto.
     * @param prisma - Cliente Prisma del contexto.
     * @returns `true` si el email fue enviado correctamente.
     * @throws UnauthorizedError si no hay sesión activa.
     */
    async sendVerificationEmail(
      _: unknown,
      __: unknown,
      { user, prisma }: GraphQLContext,
    ): Promise<boolean> {
      // Esta mutación sí requiere sesión, a diferencia de verifyEmail
      if (!user) {
        throw new UnauthorizedError('Debes iniciar sesión para verificar tu email');
      }
      const service = new EmailVerificationService(prisma);
      await service.sendVerificationEmail(user.id);
      return true;
    },

    /**
     * Verifica un token recibido desde el enlace de confirmación en el email.
     * Esta mutación es pública (no requiere sesión) porque el usuario
     * accede a ella directamente desde su cliente de correo.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param token - Token de verificación incluido en el enlace del email.
     * @param prisma - Cliente Prisma del contexto.
     * @returns `true` si el token era válido y el email fue verificado.
     * @throws ValidationError si el token es inválido, ya fue usado o expiró.
     */
    async verifyEmail(
      _: unknown,
      { token }: { token: string },
      { prisma }: GraphQLContext,
    ): Promise<boolean> {
      const service = new EmailVerificationService(prisma);
      return service.verifyEmail(token);
    },
  },
};
