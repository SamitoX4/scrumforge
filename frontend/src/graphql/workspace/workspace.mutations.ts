/**
 * @fileoverview Mutaciones GraphQL del módulo Workspace.
 *
 * Gestiona las operaciones de escritura sobre el workspace, que es la
 * entidad raíz del sistema multi-tenant de ScrumForge. Cada workspace
 * representa una organización y contiene todos sus equipos, proyectos
 * y miembros.
 *
 * La creación de workspaces se encuentra en `project.mutations.ts` dentro
 * del flujo de onboarding; este módulo se encarga exclusivamente de las
 * operaciones de mantenimiento sobre workspaces ya existentes.
 */

import { gql } from '@apollo/client';

/**
 * Actualiza el nombre y/o slug de un workspace existente.
 *
 * El `slug` es el identificador URL-friendly del workspace (ej.
 * "mi-empresa" en "app.scrumforge.dev/mi-empresa"). Cambiarlo afecta
 * a todas las URLs del workspace, por lo que debe hacerse con precaución
 * e informando a los usuarios. El servidor valida la unicidad del slug
 * antes de aplicar el cambio.
 *
 * @param $id {ID} - Identificador del workspace a actualizar.
 * @param $input {UpdateWorkspaceInput} - Campos a modificar: nombre
 *   y/o slug del workspace.
 * @returns Workspace actualizado con id, nombre y slug nuevos.
 */
export const UPDATE_WORKSPACE = gql`
  mutation UpdateWorkspace($id: ID!, $input: UpdateWorkspaceInput!) {
    updateWorkspace(id: $id, input: $input) {
      id
      name
      slug
    }
  }
`;

/**
 * Elimina un workspace y todos sus datos asociados de forma permanente.
 *
 * Esta es la operación más destructiva del sistema: elimina en cascada
 * todos los equipos, proyectos, sprints, historias de usuario, tareas,
 * comentarios y miembros del workspace. El servidor requiere que el
 * usuario sea propietario (Owner) del workspace para ejecutar esta
 * operación.
 *
 * La UI debe solicitar confirmación explícita (idealmente escribiendo
 * el nombre del workspace) antes de invocar esta mutación.
 *
 * @param $id {ID} - Identificador del workspace a eliminar.
 * @returns Boolean indicando si la eliminación fue exitosa.
 */
export const DELETE_WORKSPACE = gql`
  mutation DeleteWorkspace($id: ID!) {
    deleteWorkspace(id: $id)
  }
`;
