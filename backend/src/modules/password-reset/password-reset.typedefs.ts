/**
 * @file password-reset.typedefs.ts
 * @module password-reset
 * @description Definición del esquema GraphQL para el restablecimiento de contraseña.
 *
 * Extiende el tipo `Mutation` con dos operaciones públicas (sin autenticación):
 * - `forgotPassword`: inicia el flujo enviando un email con token.
 * - `resetPassword`: completa el flujo aplicando la nueva contraseña.
 *
 * Ambas retornan `Boolean!` para indicar éxito. El diseño intencional
 * de `forgotPassword` es retornar siempre `true` para prevenir la
 * enumeración de cuentas de usuario (seguridad por oscuridad).
 */
export const passwordResetTypeDefs = `#graphql
  extend type Mutation {
    """
    Inicia el flujo de restablecimiento de contraseña.
    Envía un email con enlace de recuperación si el correo está registrado.
    Siempre retorna true para no revelar si el email existe.
    """
    forgotPassword(email: String!): Boolean!

    """
    Restablece la contraseña usando el token recibido por email.
    Falla si el token es inválido, ya fue usado o ha expirado.
    """
    resetPassword(token: String!, newPassword: String!): Boolean!
  }
`;
