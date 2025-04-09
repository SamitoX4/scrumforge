/**
 * @file auth-extended.mutations.ts
 * @module graphql/mutations
 * @description Mutations GraphQL para los flujos extendidos de autenticación:
 * verificación de email y recuperación/restablecimiento de contraseña. Estas
 * operaciones complementan las mutations básicas de login/register definidas
 * en el módulo principal de auth.
 *
 * @note Todas las mutations de este módulo son "sin retorno de datos": devuelven
 * un booleano o string de confirmación porque el resultado significativo se
 * comunica fuera de banda (por email al usuario). El frontend solo necesita
 * saber si la operación fue aceptada por el servidor.
 */

// src/graphql/mutations/auth-extended.mutations.ts
import { gql } from '@apollo/client';

/**
 * @constant SEND_VERIFICATION_EMAIL
 * @description Solicita al backend que envíe un email de verificación de dirección
 * de correo al usuario actualmente autenticado. Se utiliza en el banner de
 * "verifica tu email" que aparece tras el registro y en la pantalla de configuración
 * de cuenta.
 *
 * No recibe parámetros porque el backend obtiene el email del JWT en la cabecera.
 *
 * @returns {boolean} `true` si el email fue enviado correctamente.
 *
 * @note El token de verificación es generado y almacenado en el backend con TTL
 * de 24 horas. Si el usuario solicita un nuevo email, el token anterior se invalida.
 */
export const SEND_VERIFICATION_EMAIL = gql`
  mutation SendVerificationEmail {
    sendVerificationEmail
  }
`;

/**
 * @constant VERIFY_EMAIL
 * @description Verifica la dirección de email del usuario usando el token recibido
 * por correo. Se ejecuta automáticamente cuando el usuario hace clic en el enlace
 * del email de verificación, que redirige a una ruta de la SPA con el token como
 * query parameter.
 *
 * @param {string} token — Token de verificación de un solo uso incluido en el email.
 *                         Tiene TTL de 24 horas y se invalida tras el primer uso.
 *
 * @returns {boolean} `true` si el email fue verificado exitosamente. El frontend
 *                    actualiza el estado del usuario en el store tras la confirmación.
 *
 * @note Tras una verificación exitosa, el frontend debería invalidar el caché de
 * ME_QUERY para reflejar el campo `emailVerified` actualizado en el perfil.
 */
export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token)
  }
`;

/**
 * @constant FORGOT_PASSWORD
 * @description Inicia el flujo de recuperación de contraseña enviando un email
 * con un enlace de restablecimiento al correo indicado. Se usa en la pantalla
 * de login cuando el usuario no recuerda su contraseña.
 *
 * @param {string} email — Dirección de correo del usuario que quiere recuperar acceso.
 *
 * @returns {boolean} Siempre devuelve `true` independientemente de si el email
 *                    existe en el sistema. Esta decisión de diseño es intencional
 *                    para prevenir la enumeración de usuarios registrados (user enumeration).
 *
 * @note Por seguridad, el backend responde con éxito aunque el email no exista.
 * El frontend muestra siempre el mismo mensaje genérico de "si el email existe,
 * recibirás instrucciones".
 */
export const FORGOT_PASSWORD = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`;

/**
 * @constant RESET_PASSWORD
 * @description Establece una nueva contraseña usando el token de recuperación
 * recibido por email. Es el segundo paso del flujo de recuperación: el usuario
 * llega a esta pantalla desde el enlace del email de forgot password.
 *
 * @param {string} token       — Token de recuperación de contraseña de un solo uso.
 *                               Se invalida tras el primer uso exitoso o al expirar.
 * @param {string} newPassword — Nueva contraseña en texto plano. El backend aplica
 *                               las validaciones de seguridad y el hashing (bcrypt).
 *
 * @returns {boolean} `true` si la contraseña fue restablecida correctamente.
 *                    Tras el éxito, el frontend redirige al login.
 *
 * @note El token de reset tiene un TTL corto (habitualmente 1 hora) para minimizar
 * la ventana de ataque. Tras usarlo, el usuario debe hacer login con la nueva contraseña.
 */
export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;
