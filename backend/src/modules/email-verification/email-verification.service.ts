/**
 * @file email-verification.service.ts
 * @module email-verification
 * @description Servicio de verificación de correo electrónico.
 *
 * Gestiona el flujo completo de verificación de email:
 * 1. Generación de tokens seguros (32 bytes aleatorios en hex).
 * 2. Invalidación de tokens previos sin usar.
 * 3. Envío del correo con el enlace de verificación.
 * 4. Validación del token y marcado del email como verificado.
 * 5. Envío asíncrono del correo de bienvenida tras la verificación.
 *
 * Los tokens expiran en 24 horas (`EMAIL_VERIFICATION_EXPIRY_HOURS`).
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../../services/email.service';
import { NotFoundError, ValidationError } from '../../utils/error.utils';

/** Tiempo de validez del token de verificación en horas. */
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

/**
 * @class EmailVerificationService
 * @description Orquesta el envío y la validación de tokens de verificación de email.
 * Instancia un `EmailService` internamente para el envío de correos.
 */
export class EmailVerificationService {
  private readonly emailService: EmailService;

  constructor(private readonly db: PrismaClient) {
    // Se instancia el servicio de email en el constructor para reutilizarlo
    this.emailService = new EmailService();
  }

  /**
   * Envía un correo de verificación al usuario identificado por `userId`.
   *
   * Flujo:
   * 1. Verifica que el usuario exista.
   * 2. Lanza error si el email ya está verificado.
   * 3. Elimina tokens previos no usados para evitar tokens huérfanos.
   * 4. Genera un token criptográficamente seguro de 32 bytes en hex (64 chars).
   * 5. Calcula la fecha de expiración (ahora + 24h).
   * 6. Persiste el token y envía el correo.
   *
   * @param userId - ID del usuario al que enviar el correo.
   * @throws NotFoundError si el usuario no existe.
   * @throws ValidationError si el email ya fue verificado anteriormente.
   */
  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('Usuario');
    }

    // No tiene sentido enviar verificación si el email ya fue confirmado
    if (user.emailVerifiedAt) {
      throw new ValidationError('El correo ya ha sido verificado');
    }

    // Invalidate any existing tokens for this user
    // Se eliminan para evitar que el usuario acumule tokens activos
    await this.db.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });

    // Token de 32 bytes = 64 caracteres hexadecimales; suficientemente seguro
    const token = crypto.randomBytes(32).toString('hex');

    // Se convierte horas a milisegundos para el cálculo de la fecha de expiración
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.db.emailVerificationToken.create({
      data: { userId, token, expiresAt },
    });

    await this.emailService.sendVerificationEmail(user.email, user.name, token);
  }

  /**
   * Verifica el token recibido desde el enlace de confirmación del email.
   *
   * Validaciones en orden:
   * 1. El token debe existir en la base de datos.
   * 2. No debe haber sido utilizado previamente.
   * 3. No debe haber expirado.
   *
   * Si todas las validaciones pasan, se ejecuta una transacción atómica
   * que marca el email del usuario como verificado y el token como usado.
   *
   * Tras la verificación, se envía el correo de bienvenida de forma asíncrona
   * (fire-and-forget) para no bloquear la respuesta al cliente.
   *
   * @param token - Token de verificación en formato hexadecimal.
   * @returns `true` si la verificación fue exitosa.
   * @throws ValidationError si el token es inválido, ya fue usado o expiró.
   */
  async verifyEmail(token: string): Promise<boolean> {
    const record = await this.db.emailVerificationToken.findUnique({ where: { token } });

    if (!record) {
      throw new ValidationError('Token de verificación inválido');
    }

    // El token ya fue utilizado en una verificación anterior
    if (record.usedAt) {
      throw new ValidationError('Este token ya fue utilizado');
    }

    // Se compara la fecha de expiración con el momento actual
    if (record.expiresAt < new Date()) {
      throw new ValidationError('El token de verificación ha expirado');
    }

    // Transacción atómica: ambas operaciones deben completarse o ninguna
    await this.db.$transaction([
      // 1. Marcar el email del usuario como verificado con la fecha actual
      this.db.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      // 2. Marcar el token como usado para evitar reutilización
      this.db.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Send welcome email asynchronously — ignore failures
    // El correo de bienvenida es opcional; los errores no deben afectar la respuesta
    this.db.user.findUnique({ where: { id: record.userId } }).then((user) => {
      if (user) {
        this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);
      }
    }).catch(() => undefined);

    return true;
  }
}
