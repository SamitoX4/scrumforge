/**
 * @file workspace.queries.ts
 * @module graphql/workspace
 * @description Queries GraphQL para la gestión de workspaces (espacios de trabajo).
 * ScrumForge es una plataforma multi-tenant donde cada workspace representa una
 * organización o equipo independiente. Estas queries alimentan el selector de workspace,
 * el onboarding y las vistas de configuración de organización.
 */

// src/graphql/workspace/workspace.queries.ts
import { gql } from '@apollo/client';

/**
 * @constant GET_WORKSPACE_BY_SLUG
 * @description Obtiene un workspace específico usando su slug URL-amigable.
 * Se utiliza principalmente en la resolución de rutas cuando el workspace está
 * identificado en la URL (ej.: `/ws/mi-empresa/projects`). Incluye `planLimits`
 * que no está presente en las otras queries de workspace.
 *
 * @param {string} slug — Identificador URL-amigable del workspace (ej.: "mi-empresa").
 *
 * @returns {Object | null} Workspace encontrado o null si no existe:
 *   - `id`         — UUID del workspace.
 *   - `name`       — Nombre visible del workspace.
 *   - `slug`       — Slug URL-amigable único.
 *   - `ownerId`    — ID del usuario propietario/administrador del workspace.
 *   - `createdAt`  — Fecha de creación.
 *   - `planLimits` — Escalar JSON con los límites del plan contratado (usuarios,
 *                    proyectos, features de IA, etc.). Solo se incluye en esta
 *                    query porque se necesita para enforcement de límites en la UI.
 *   - `teams`      — Lista de equipos `{ id, name }` para navegación secundaria.
 *
 * @note `planLimits` es un escalar JSON que contiene restricciones del plan
 * (FREE, PRO, ENTERPRISE). Se usa en la capa de presentación para mostrar
 * banners de upgrade y deshabilitar features según el plan.
 */
export const GET_WORKSPACE_BY_SLUG = gql`
  query GetWorkspaceBySlug($slug: String!) {
    workspaceBySlug(slug: $slug) {
      id
      name
      slug
      ownerId
      createdAt
      planLimits
      teams {
        id
        name
      }
    }
  }
`;

/**
 * @constant GET_WORKSPACES
 * @description Obtiene todos los workspaces a los que tiene acceso el usuario
 * autenticado. No recibe parámetros porque el backend filtra automáticamente
 * según el JWT. Se usa en el selector de workspace del sidebar y en la pantalla
 * de inicio tras el login.
 *
 * @returns {Object[]} Lista de workspaces accesibles por el usuario con:
 *   - `id`        — UUID del workspace.
 *   - `name`      — Nombre del workspace para mostrar en el selector.
 *   - `slug`      — Slug para construir las URLs de navegación.
 *   - `ownerId`   — Permite determinar si el usuario es propietario.
 *   - `createdAt` — Fecha de creación para ordenamiento.
 *   - `teams`     — Lista de equipos `{ id, name }` como preview rápido.
 *
 * @note A diferencia de GET_WORKSPACE_BY_SLUG, esta query NO incluye `planLimits`
 * para optimizar el peso de la respuesta en el listado inicial.
 */
export const GET_WORKSPACES = gql`
  query GetWorkspaces {
    workspaces {
      id
      name
      slug
      ownerId
      createdAt
      teams {
        id
        name
      }
    }
  }
`;

/**
 * @constant GET_WORKSPACE
 * @description Obtiene un workspace específico por su ID. Se usa en contextos donde
 * ya se conoce el UUID del workspace (ej.: desde el store de estado, configuración
 * de proyecto, panel de administración). Es la query de detalle canónica cuando
 * no se dispone del slug pero sí del ID.
 *
 * @param {string} id — UUID del workspace a consultar.
 *
 * @returns {Object | null} Workspace encontrado o null si no existe/no tiene acceso:
 *   - `id`        — UUID del workspace.
 *   - `name`      — Nombre del workspace.
 *   - `slug`      — Slug para construir URLs de navegación.
 *   - `ownerId`   — ID del propietario para control de permisos en UI.
 *   - `createdAt` — Fecha de creación.
 *   - `teams`     — Lista de equipos `{ id, name }`.
 *
 * @note Esta query tiene los mismos campos que GET_WORKSPACES (sin `planLimits`).
 * Si se necesitan los límites del plan, usar GET_WORKSPACE_BY_SLUG en su lugar.
 */
export const GET_WORKSPACE = gql`
  query GetWorkspace($id: ID!) {
    workspace(id: $id) {
      id
      name
      slug
      ownerId
      createdAt
      teams {
        id
        name
      }
    }
  }
`;
