/**
 * @file auth.service.ts
 * @description Lógica de negocio para autenticación de usuarios.
 *
 * Responsabilidades:
 * - Registro de usuarios con hash de contraseña y envío de verificación de email.
 * - Login con protección ante fuerza bruta (bloqueo por intentos fallidos).
 * - Rotación de refresh tokens (cada token se usa una única vez).
 * - Construcción del payload JWT con almacenamiento del refresh token en BD.
 */
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
} from '../../utils/crypto.utils';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/error.utils';
import {
  IAuthService,
  IAuthPayload,
  ILoginInput,
  IRegisterInput,
} from './auth.types';
import { EmailService } from '../../services/email.service';
import { validatePassword } from '../../utils/password.utils';

/** Tiempo de validez del token de verificación de email enviado en el registro. */
const EMAIL_VERIFICATION_EXPIRY_HOURS = 1;

/** Número máximo de contraseñas incorrectas antes de bloquear la cuenta. */
const LOGIN_MAX_ATTEMPTS = 5;

/** Minutos que permanece bloqueada la cuenta tras superar el límite de intentos. */
const LOGIN_LOCKOUT_MINUTES = 60;

/**
 * Servicio de autenticación de ScrumForge.
 * Implementa {@link IAuthService} para mantener el contrato con los resolvers
 * y facilitar la sustitución por mocks en tests.
 */
export class AuthService implements IAuthService {
  /** Servicio de email reutilizado para verificación y bienvenida. */
  private readonly emailService: EmailService;

  /**
   * @param db - Cliente Prisma. Se inyecta desde el contexto de Apollo
   *             para que cada request maneje su propia conexión.
   */
  constructor(private readonly db: PrismaClient) {
    this.emailService = new EmailService();
  }

  /**
   * Registra un nuevo usuario en el sistema.
   *
   * Pasos:
   * 1. Valida la contraseña contra la política de seguridad (longitud, mayúscula, minúscula, dígito).
   * 2. Verifica unicidad del email.
   * 3. Crea el usuario con la contraseña hasheada.
   * 4. Dispara el envío del email de verificación de forma asíncrona.
   * 5. Construye y devuelve el payload JWT.
   *
   * @param input - Nombre, email y contraseña en texto plano.
   * @throws {ValidationError} Si la contraseña no cumple la política de seguridad.
   * @throws {ConflictError} Si el email ya está registrado.
   */
  async register(input: IRegisterInput): Promise<IAuthPayload> {
    const { name, email, password } = input;

    const passwordError = validatePassword(password);
    if (passwordError) {
      throw new ValidationError(passwordError);
    }

    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('Ya existe una cuenta con ese correo electrónico');
    }

    const hashedPassword = await hashPassword(password);
    const user = await this.db.user.create({
      data: { name, email, password: hashedPassword, emailVerifiedAt: null },
    });

    // Disparar verificación de email de forma asíncrona — no bloquear el registro
    this.sendVerificationTokenFor(user.id, user.email, user.name).catch(() => undefined);

    return this.buildPayload(user);
  }

  /**
   * Autentica a un usuario con email y contraseña.
   *
   * Pasos:
   * 1. Busca el usuario por email.
   * 2. Verifica si la cuenta está bloqueada por intentos fallidos.
   * 3. Compara la contraseña con el hash almacenado.
   * 4. Si es incorrecta, incrementa el contador de intentos fallidos
   *    y bloquea la cuenta si se alcanza el límite.
   * 5. Exige que el email esté verificado antes de emitir tokens.
   * 6. Reinicia el contador de intentos en caso de éxito.
   *
   * @param input - Email y contraseña en texto plano.
   * @throws {UnauthorizedError} Para credenciales inválidas, cuenta bloqueada
   *                             o email no verificado (mismo mensaje genérico
   *                             para no revelar si el email existe).
   */
  async login(input: ILoginInput): Promise<IAuthPayload> {
    const { email, password } = input;

    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Credenciales incorrectas');
    }

    // Comprobar bloqueo de cuenta antes de validar la contraseña
    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      // Calcular minutos restantes para informar al usuario sin revelar el timestamp exacto
      const minutesLeft = Math.ceil((user.loginLockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedError(
        `Demasiados intentos fallidos. Intenta de nuevo en ${minutesLeft} min.`,
      );
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      const attempts = user.loginAttempts + 1;
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        // Bloquear la cuenta por LOGIN_LOCKOUT_MINUTES minutos
        await this.db.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: attempts,
            loginLockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60_000),
          },
        });
        throw new UnauthorizedError(
          `Demasiados intentos fallidos. Los intentos se reiniciarán en ${LOGIN_LOCKOUT_MINUTES} min.`,
        );
      }
      // Incrementar contador sin bloquear aún
      await this.db.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts },
      });
      throw new UnauthorizedError('Credenciales incorrectas');
    }

    // No permitir login si el usuario no ha verificado su correo
    if (user.emailVerifiedAt === null) {
      throw new UnauthorizedError(
        'Debes verificar tu correo electrónico antes de iniciar sesión',
      );
    }

    // Reiniciar contadores de seguridad tras un login exitoso
    await this.db.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, loginLockedUntil: null },
    });

    return this.buildPayload(user);
  }

  // ─── helpers privados ──────────────────────────────────────────────────────

  /**
   * Genera y persiste un token de verificación de email para el usuario indicado,
   * eliminando previamente cualquier token no utilizado para evitar acumulación.
   * El envío del correo se realiza aquí; los errores no se propagan porque
   * el registro debe completarse aunque el servicio de email falle.
   *
   * @param userId - ID del usuario recién creado.
   * @param email  - Dirección de correo destino.
   * @param name   - Nombre del usuario para personalizar el email.
   */
  private async sendVerificationTokenFor(userId: string, email: string, name: string): Promise<void> {
    try {
      // Eliminar tokens previos no usados para no acumular tokens huérfanos en BD
      await this.db.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
      // Generar token criptográficamente seguro de 32 bytes (64 caracteres hex)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);
      await this.db.emailVerificationToken.create({ data: { userId, token, expiresAt } });
      await this.emailService.sendVerificationEmail(email, name, token);
    } catch {
      // No fatal: el registro termina correctamente aunque el email falle
    }
  }

  /**
   * Rota el refresh token: invalida el token presentado y emite un par nuevo.
   * La rotación garantiza que un token robado sólo pueda usarse una vez.
   *
   * @param refreshToken - Token de refresco activo del cliente.
   * @throws {UnauthorizedError} Si el token no existe o está expirado.
   */
  async refreshTokens(refreshToken: string): Promise<IAuthPayload> {
    const stored = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      // Limpiar el token expirado si existe para no dejar basura en BD
      if (stored) {
        await this.db.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new UnauthorizedError('Token de refresco inválido o expirado');
    }

    // Invalidar el token antiguo e inmediatamente emitir uno nuevo
    await this.db.refreshToken.delete({ where: { id: stored.id } });
    return this.buildPayload(stored.user);
  }

  /**
   * Cierra la sesión eliminando el refresh token de la BD.
   * Si el token ya no existía (p. ej. fue revocado por otra sesión) se
   * ignora silenciosamente para que el cliente siempre reciba `true`.
   *
   * @param refreshToken - Token de refresco a invalidar.
   * @returns `true` siempre.
   */
  async logout(refreshToken: string): Promise<boolean> {
    try {
      await this.db.refreshToken.delete({ where: { token: refreshToken } });
    } catch {
      // El token puede no existir — eso es correcto, el resultado es el mismo
    }
    return true;
  }

  // ─── privado ───────────────────────────────────────────────────────────────

  /**
   * Construye el payload de autenticación firmando nuevos tokens y
   * persistiendo el refresh token en la BD.
   *
   * La duración del refresh token se lee de la variable de entorno
   * `JWT_REFRESH_EXPIRES_IN` (formato `"Nd"` donde N es días); si no está
   * definida se usa 30 días como valor por defecto.
   *
   * @param user - Datos mínimos del usuario requeridos para firmar el JWT.
   * @returns Payload con access token, refresh token y datos del usuario.
   */
  private async buildPayload(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    emailVerifiedAt: Date | null;
  }): Promise<IAuthPayload> {
    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshTokenValue = signRefreshToken({ userId: user.id, email: user.email });

    // Parsear expiración del refresh token desde el entorno o usar 30 días por defecto
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';
    const days = parseInt(expiresIn.replace('d', ''), 10) || 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Persistir el refresh token en BD para poder revocarlo en logout/rotación
    await this.db.refreshToken.create({
      data: { token: refreshTokenValue, userId: user.id, expiresAt },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }
}
