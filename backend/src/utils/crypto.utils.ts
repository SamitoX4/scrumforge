/**
 * @file crypto.utils.ts
 * @module utils
 * @description Utilidades criptográficas para autenticación y seguridad.
 *
 * Centraliza todas las operaciones criptográficas del backend:
 * - Hash y verificación de contraseñas con bcrypt.
 * - Generación y verificación de tokens JWT (access y refresh).
 * - Generación de tokens aleatorios seguros para emails de verificación y reset.
 *
 * Las claves y configuraciones se leen de variables de entorno en tiempo
 * de ejecución. Si `JWT_SECRET` no está definida, las operaciones JWT
 * lanzan un error para evitar tokens inseguros en producción.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Número de rondas de sal para bcrypt. 12 rondas es el balance recomendado
 * entre seguridad y rendimiento (~250ms por hash en hardware moderno).
 * Aumentar este valor hace el hash más seguro pero más lento.
 */
const SALT_ROUNDS = 12;

/**
 * Genera el hash bcrypt de una contraseña en texto plano.
 * Usa `SALT_ROUNDS` para la derivación de la sal; el salt se incluye
 * automáticamente en el hash resultante.
 *
 * @param plain - Contraseña en texto plano a hashear.
 * @returns Hash bcrypt de la contraseña.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano con su hash bcrypt almacenado.
 * bcrypt extrae la sal del hash para realizar la comparación de forma segura,
 * evitando ataques de timing al comparar en tiempo constante.
 *
 * @param plain - Contraseña en texto plano ingresada por el usuario.
 * @param hashed - Hash bcrypt almacenado en la base de datos.
 * @returns `true` si la contraseña coincide con el hash, `false` en caso contrario.
 */
export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/**
 * @interface JwtPayload
 * @description Estructura del payload incluido en los tokens JWT.
 * Solo contiene datos no sensibles necesarios para la autenticación.
 */
export interface JwtPayload {
  /** Identificador único del usuario en la base de datos. */
  userId: string;
  /** Email del usuario para identificación adicional. */
  email: string;
}

/**
 * Genera un token JWT de acceso (corta duración) para el usuario.
 * La expiración se configura con `JWT_EXPIRES_IN` (por defecto 7 días).
 *
 * @param payload - Datos del usuario a incluir en el token.
 * @returns Token JWT firmado como cadena.
 * @throws Error si `JWT_SECRET` no está definida en el entorno.
 */
export function signAccessToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');

  // El tipo se castea para compatibilidad con las opciones de jsonwebtoken
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Genera un token JWT de refresco (larga duración) para renovar tokens de acceso.
 * La expiración se configura con `JWT_REFRESH_EXPIRES_IN` (por defecto 30 días).
 *
 * @param payload - Datos del usuario a incluir en el token.
 * @returns Token JWT de refresco firmado como cadena.
 * @throws Error si `JWT_SECRET` no está definida en el entorno.
 */
export function signRefreshToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verifica y decodifica un token JWT, retornando su payload.
 * Lanza una excepción si el token es inválido, ha expirado o fue manipulado.
 *
 * @param token - Token JWT a verificar.
 * @returns El payload decodificado del token.
 * @throws Error si `JWT_SECRET` no está definida.
 * @throws JsonWebTokenError si el token es inválido.
 * @throws TokenExpiredError si el token ha expirado.
 */
export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  return jwt.verify(token, secret) as JwtPayload;
}

/**
 * Genera un token aleatorio criptográficamente seguro de 40 bytes (80 chars hex).
 * Se usa para tokens de verificación de email, restablecimiento de contraseña
 * e invitaciones a workspace donde se necesita impredecibilidad garantizada.
 *
 * 40 bytes = 320 bits de entropía, suficiente para resistir ataques de fuerza bruta.
 *
 * @returns Cadena hexadecimal aleatoria de 80 caracteres.
 */
export function generateRandomToken(): string {
  return crypto.randomBytes(40).toString('hex');
}
