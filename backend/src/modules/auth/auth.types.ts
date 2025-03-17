/**
 * @file auth.types.ts
 * @description Interfaces TypeScript del módulo de autenticación.
 * Centralizar los contratos aquí desacopla el servicio de cualquier
 * implementación concreta y facilita el testeo con mocks.
 */

/**
 * Datos necesarios para registrar un nuevo usuario.
 */
export interface IRegisterInput {
  /** Nombre visible del usuario. */
  name: string;
  /** Correo electrónico único que identifica la cuenta. */
  email: string;
  /** Contraseña en texto plano — se hashea en el servicio antes de persistir. */
  password: string;
}

/**
 * Credenciales requeridas para iniciar sesión.
 */
export interface ILoginInput {
  /** Correo electrónico registrado. */
  email: string;
  /** Contraseña en texto plano — se compara con el hash almacenado. */
  password: string;
}

/**
 * Respuesta devuelta tras una operación de autenticación exitosa
 * (registro, login o refresco de tokens).
 * El cliente debe almacenar ambos tokens de forma segura:
 * - `accessToken` en memoria (corta duración).
 * - `refreshToken` en una cookie HttpOnly o almacenamiento seguro.
 */
export interface IAuthPayload {
  /** JWT de acceso de corta duración (por defecto 15 min). */
  accessToken: string;
  /** JWT de refresco de larga duración usado para obtener nuevos access tokens. */
  refreshToken: string;
  /** Datos públicos del usuario autenticado. */
  user: {
    id: string;
    email: string;
    name: string;
    /** URL del avatar; puede ser null si el usuario no ha subido ninguno. */
    avatarUrl: string | null;
    /** Fecha en que el correo fue verificado; null si aún no se ha verificado. */
    emailVerifiedAt: Date | null;
  };
}

/**
 * Contrato que debe cumplir cualquier implementación del servicio de autenticación.
 * Usar una interfaz aquí permite sustituir la implementación real por un mock en tests
 * sin tocar los resolvers ni el resto del código.
 */
export interface IAuthService {
  /**
   * Registra un nuevo usuario y devuelve tokens de sesión.
   * @param input - Datos del nuevo usuario.
   */
  register(input: IRegisterInput): Promise<IAuthPayload>;

  /**
   * Autentica a un usuario existente con email y contraseña.
   * @param input - Credenciales del usuario.
   */
  login(input: ILoginInput): Promise<IAuthPayload>;

  /**
   * Rota el refresh token: invalida el token actual y emite uno nuevo junto a
   * un nuevo access token. Esto limita la ventana de uso si un token es robado.
   * @param refreshToken - Token de refresco vigente.
   */
  refreshTokens(refreshToken: string): Promise<IAuthPayload>;

  /**
   * Invalida el refresh token en base de datos, cerrando la sesión del cliente.
   * @param refreshToken - Token de refresco a eliminar.
   * @returns `true` si la operación se completó (incluso si el token no existía).
   */
  logout(refreshToken: string): Promise<boolean>;
}
