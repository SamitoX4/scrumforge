/**
 * @file index.ts
 * @module email-verification
 * @description Punto de entrada del módulo de verificación de email.
 *
 * Re-exporta los tres artefactos principales del módulo para que el
 * servidor Apollo pueda registrarlos de forma centralizada:
 * - `emailVerificationTypeDefs`: definición del esquema GraphQL.
 * - `emailVerificationResolvers`: implementación de las mutaciones.
 * - `EmailVerificationService`: clase de servicio para uso en otros módulos.
 */
export { emailVerificationTypeDefs } from './email-verification.typedefs';
export { emailVerificationResolvers } from './email-verification.resolver';
export { EmailVerificationService } from './email-verification.service';
