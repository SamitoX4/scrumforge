/**
 * @file password-reset.service.ts
 * @description Servicio para el flujo de restablecimiento de contraseña por email.
 *
 * Implementa el patrón estándar de "forgot password" con tokens de un solo uso:
 * 1. El usuario solicita un restablecimiento → se genera un token seguro y se envía por email.
 * 2. El usuario hace clic en el enlace del email → se valida el token y se cambia la contraseña.
 *
 * Consideraciones de seguridad:
 * - `forgotPassword` siempre devuelve true para evitar la enumeración de emails
 *   (un atacante no puede saber si un email está registrado).
 * - Los tokens expiran en 1 hora para limitar la ventana de ataque.
 * - Al restablecer, se invalidan todos los refresh tokens activos del usuario
 *   para forzar un nuevo inicio de sesión en todos los dispositivos.
 * - El cambio de contraseña y la marcación del token como usado se ejecutan
 *   en una transacción atómica para evitar estados inconsistentes.
 */
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../../services/email.service';
import { ValidationError } from '../../utils/error.utils';
import { hashPassword } from '../../utils/crypto.utils';
import { validatePassword } from '../../utils/password.utils';

/** Tiempo de validez del token de restablecimiento en horas */
const PASSWORD_RESET_EXPIRY_HOURS = 1;

/**
 * Servicio para el flujo de restablecimiento de contraseña.
 *
 * Gestiona la generación de tokens seguros, su envío por email y la
 * validación del token al momento de cambiar la contraseña.
 */
export class PasswordResetService {
  private readonly emailService: EmailService;

  constructor(private readonly db: PrismaClient) {
    this.emailService = new EmailService();
  }

  /**
   * Inicia el flujo de restablecimiento de contraseña para un email dado.
   *
   * Proceso:
   * 1. Busca el usuario por email; si no existe, devuelve true sin revelar el motivo.
   * 2. Invalida cualquier token previo sin usar para evitar tokens huérfanos activos.
   * 3. Genera un token criptográficamente seguro de 32 bytes (64 caracteres hex).
   * 4. Persiste el token con su fecha de expiración y envía el email.
   *
   * Siempre retorna true para prevenir ataques de enumeración de emails
   * (el cliente no puede distinguir entre "email no existe" y "email enviado").
   *
   * @param email - Dirección de email del usuario que solicita el restablecimiento
   * @returns Siempre true (independientemente de si el email existe o no)
   */
  async forgotPassword(email: string): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) {
      // Devolver true aunque el usuario no exista: previene enumeración de emails
      return true;
    }

    // Invalidar tokens anteriores sin usar para que solo exista un token activo a la vez
    await this.db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    // Generar token aleatorio seguro: 32 bytes → 64 caracteres hexadecimales
    const token = crypto.randomBytes(32).toString('hex');
    // Calcular la fecha de expiración sumando las horas configuradas al momento actual
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    // Enviar el email con el enlace que contiene el token
    await this.emailService.sendPasswordResetEmail(user.email, user.name, token);
    return true;
  }

  /**
   * Completa el flujo de restablecimiento validando el token y cambiando la contraseña.
   *
   * Validaciones realizadas en orden:
   * 1. La nueva contraseña debe cumplir la política de seguridad (longitud, mayúscula, minúscula, dígito).
   * 2. El token debe existir en la base de datos.
   * 3. El token no debe haber sido usado previamente.
   * 4. El token no debe haber expirado (tiempo de vida: 1 hora).
   *
   * Las tres operaciones de escritura se ejecutan en una transacción atómica:
   * - Actualizar la contraseña del usuario con el hash bcrypt.
   * - Marcar el token como usado (campo `usedAt`) para que no sea reutilizable.
   * - Eliminar todos los refresh tokens activos para cerrar sesión en todos los dispositivos.
   *
   * @param token       - Token de restablecimiento recibido por email
   * @param newPassword - Nueva contraseña en texto plano (se hashea antes de persistir)
   * @returns true si la contraseña se cambió correctamente
   * @throws ValidationError si la contraseña es demasiado corta, el token es inválido,
   *         ya fue usado o ha expirado
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // Validar política de contraseña antes de cualquier consulta a la BD
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      throw new ValidationError(passwordError);
    }

    const record = await this.db.passwordResetToken.findUnique({ where: { token } });

    // Token no encontrado en la BD (nunca existió o ya fue eliminado)
    if (!record) {
      throw new ValidationError('Token de restablecimiento inválido');
    }

    // Token ya consumido: previene reutilización si el email fue interceptado
    if (record.usedAt) {
      throw new ValidationError('Este token ya fue utilizado');
    }

    // Token expirado: ventana de 1 hora para mayor seguridad
    if (record.expiresAt < new Date()) {
      throw new ValidationError('El token de restablecimiento ha expirado');
    }

    // Hashear la contraseña antes de persistirla (nunca almacenar contraseñas en texto plano)
    const hashedPassword = await hashPassword(newPassword);

    // Transacción atómica: las tres operaciones deben completarse juntas o fallar juntas
    await this.db.$transaction([
      // 1. Actualizar la contraseña del usuario con el hash
      this.db.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      }),
      // 2. Marcar el token como usado para que no sea reutilizable
      this.db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // 3. Revocar todos los refresh tokens activos: fuerza reautenticación en todos los dispositivos
      this.db.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    return true;
  }
}
