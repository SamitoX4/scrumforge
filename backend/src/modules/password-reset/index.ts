/**
 * @file index.ts
 * @module password-reset
 * @description Punto de entrada del módulo de restablecimiento de contraseña.
 *
 * Re-exporta los tres artefactos principales del módulo para registro
 * centralizado en el servidor Apollo:
 * - `passwordResetTypeDefs`: definición del esquema GraphQL.
 * - `passwordResetResolvers`: implementación de las mutaciones.
 * - `PasswordResetService`: clase de servicio para uso en otros módulos.
 */
export { passwordResetTypeDefs } from './password-reset.typedefs';
export { passwordResetResolvers } from './password-reset.resolver';
export { PasswordResetService } from './password-reset.service';
