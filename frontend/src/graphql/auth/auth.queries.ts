/**
 * @file auth.queries.ts
 * @module graphql/auth
 * @description Queries GraphQL relacionadas con la autenticación y el perfil del
 * usuario autenticado. Estas queries son utilizadas por el store de autenticación
 * (auth.store.ts) y los componentes que necesitan mostrar datos del usuario en sesión.
 */

import { gql } from '@apollo/client';

/**
 * @constant ME_QUERY
 * @description Obtiene el perfil completo del usuario actualmente autenticado.
 * El resolver del backend extrae el usuario a partir del JWT incluido en las
 * cabeceras de la solicitud, por lo que no requiere ningún parámetro explícito.
 *
 * @returns {Object} Objeto con los datos básicos del usuario en sesión:
 *   - `id`        — Identificador único del usuario (UUID).
 *   - `email`     — Correo electrónico, usado como identificador de login.
 *   - `name`      — Nombre para mostrar en la interfaz.
 *   - `avatarUrl` — URL de la imagen de perfil (puede ser nula si no se ha subido).
 *   - `createdAt` — Fecha de registro, útil para mostrar antigüedad de cuenta.
 *
 * @example
 * const { data } = useQuery(ME_QUERY);
 * // data.me.name => "John Doe"
 *
 * @note Se omiten campos sensibles como `passwordHash` o `anthropicApiKey`
 * que nunca deben exponerse al frontend según las convenciones del proyecto.
 */
export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      avatarUrl
      createdAt
    }
  }
`;
