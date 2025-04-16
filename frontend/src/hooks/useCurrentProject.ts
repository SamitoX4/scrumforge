/**
 * @file useCurrentProject.ts
 * @description Hook que obtiene los datos del proyecto activo a partir del
 * parámetro de ruta `projectId`.
 *
 * La query está definida inline (no en un archivo de operaciones compartido)
 * porque solo solicita los campos mínimos necesarios para el contexto global
 * del proyecto (nombre, key, equipo). Los componentes que necesiten más datos
 * deben hacer su propia query específica.
 *
 * Al centralizar esta lógica en un hook, cualquier componente dentro de la
 * ruta `/:workspaceSlug/projects/:projectId/*` puede acceder al proyecto
 * sin duplicar la query ni pasar props por el árbol.
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';

/**
 * Query ligera que obtiene solo los campos esenciales del proyecto.
 * Se solicita `team` para que los hooks de permisos puedan resolver el rol
 * del usuario actual sin necesitar una query adicional.
 */
const GET_PROJECT = gql`
  query GetProject($id: ID!) {
    project(id: $id) {
      id name key teamId
      team { id name }
    }
  }
`;

/**
 * Hook que devuelve el proyecto activo basándose en el param de URL `:projectId`.
 *
 * @returns Objeto con el proyecto, su ID, y el estado de la query (loading/error).
 *          `project` es `null` si la query no ha terminado o si el ID es inválido.
 *
 * @example
 * const { project, projectId, loading } = useCurrentProject();
 * if (loading) return <Spinner />;
 * if (!project) return <NotFound />;
 */
export function useCurrentProject() {
  // Extraer el projectId del segmento de URL actual (/projects/:projectId/...)
  const { projectId } = useParams<{ projectId: string }>();

  const { data, loading, error } = useQuery<any>(GET_PROJECT, {
    variables: { id: projectId },
    // Omitir la query si no hay projectId (ej. en rutas sin este param)
    skip: !projectId,
  });

  return {
    project: data?.project ?? null,
    // Normalizar a null para que los consumidores no tengan que manejar `undefined`
    projectId: projectId ?? null,
    loading,
    error,
  };
}
