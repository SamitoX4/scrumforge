/**
 * @file email-verification.typedefs.ts
 * @module email-verification
 * @description Definición del esquema GraphQL para la verificación de email.
 *
 * Extiende el tipo `Mutation` con dos operaciones:
 * - `sendVerificationEmail`: requiere autenticación; envía el correo al
 *   usuario en sesión. Retorna `true` si el envío fue exitoso.
 * - `verifyEmail`: pública; recibe el token del enlace y marca el email
 *   como verificado. Retorna `true` si la verificación fue correcta.
 */
export const emailVerificationTypeDefs = `#graphql
  extend type Mutation {
    """
    Envía un correo de verificación al usuario autenticado.
    Requiere sesión activa. Falla si el email ya fue verificado.
    """
    sendVerificationEmail: Boolean!

    """
    Verifica el email usando el token recibido por correo.
    Operación pública (no requiere sesión).
    """
    verifyEmail(token: String!): Boolean!
  }
`;
