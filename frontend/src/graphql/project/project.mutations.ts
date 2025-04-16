/**
 * @fileoverview Mutaciones GraphQL para la creación del onboarding inicial.
 *
 * Contiene las mutaciones que forman el flujo de creación de la estructura
 * organizativa de ScrumForge: workspace → equipo → proyecto. Este orden
 * es jerárquico e importante: un equipo necesita un workspace y un proyecto
 * necesita un equipo al que pertenecer.
 *
 * Estas mutaciones se utilizan principalmente en el flujo de onboarding y
 * en los formularios de creación de estructura organizativa.
 */

import { gql } from '@apollo/client';

/**
 * Crea un nuevo workspace (organización raíz del sistema multi-tenant).
 *
 * El workspace es la entidad de más alto nivel en ScrumForge. Cada
 * workspace tiene su propio `slug` único que se usa en las URLs. Al
 * crearse, puede incluir equipos iniciales; por eso se devuelve la
 * relación `teams` en la respuesta.
 *
 * @param $input {CreateWorkspaceInput} - Datos del workspace: nombre
 *   (el slug se genera automáticamente en el servidor a partir del nombre).
 * @returns Workspace creado con id, nombre, slug y equipos asociados.
 */
export const CREATE_WORKSPACE = gql`
  mutation CreateWorkspace($input: CreateWorkspaceInput!) {
    createWorkspace(input: $input) {
      id name slug
      teams { id name }
    }
  }
`;

/**
 * Crea un nuevo equipo dentro de un workspace existente.
 *
 * Los equipos agrupan miembros y proyectos dentro de un workspace. Un
 * workspace puede tener múltiples equipos, permitiendo separar áreas
 * funcionales (frontend, backend, QA) o productos distintos.
 *
 * @param $input {CreateTeamInput} - Datos del equipo: nombre y workspaceId
 *   al que pertenecerá.
 * @returns Equipo creado con su id, nombre y referencia al workspace.
 */
export const CREATE_TEAM = gql`
  mutation CreateTeam($input: CreateTeamInput!) {
    createTeam(input: $input) {
      id name workspaceId
    }
  }
`;

/**
 * Crea un nuevo proyecto dentro de un equipo.
 *
 * El campo `key` es un identificador corto único (ej. "SF", "BACKEND")
 * que se usa como prefijo en los identificadores de historias de usuario
 * (ej. "SF-42"). Se genera automáticamente a partir del nombre del proyecto
 * si no se especifica explícitamente.
 *
 * @param $input {CreateProjectInput} - Datos del proyecto: nombre, clave
 *   corta y teamId al que pertenecerá.
 * @returns Proyecto creado con id, nombre, clave y referencia al equipo.
 */
export const CREATE_PROJECT = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id name key teamId
    }
  }
`;
