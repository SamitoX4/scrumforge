/**
 * @file useActiveSprint.ts
 * @description Hook que obtiene el sprint activo de un proyecto y sus historias de usuario.
 *
 * Centraliza la query `GET_ACTIVE_SPRINT` para evitar duplicación de código
 * entre los distintos consumidores (BoardView, ReportsView, SprintPlanning, etc.).
 * Apollo se encarga de cachear el resultado, por lo que múltiples componentes
 * pueden llamar a este hook sin generar requests de red redundantes.
 */
import { useQuery } from '@apollo/client/react';
import { GET_ACTIVE_SPRINT } from '@/graphql/sprint/sprint.queries';
import type { Sprint, UserStory } from '@/types/api.types';

/**
 * Resultado devuelto por `useActiveSprint`.
 *
 * @property sprint   - Sprint activo completo, o null si no existe ninguno.
 * @property stories  - Historias de usuario del sprint activo (array vacío si no hay sprint).
 * @property loading  - True mientras Apollo espera la respuesta del servidor.
 * @property error    - Error de red o GraphQL, si ocurrió alguno.
 * @property refetch  - Función para reforzar una recarga manual de los datos.
 */
interface UseActiveSprintResult {
  sprint: Sprint | null;
  stories: UserStory[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
}

/**
 * Hook que obtiene el sprint activo de un proyecto.
 *
 * @param projectId - ID del proyecto cuyo sprint activo se quiere obtener.
 *                    Si es `null`, la query se omite (`skip: true`) y se devuelven
 *                    valores vacíos para evitar renders con datos parciales.
 * @returns Estado del sprint activo y sus historias de usuario.
 *
 * @example
 * const { sprint, stories, loading } = useActiveSprint(projectId);
 * if (loading) return <Spinner />;
 * if (!sprint) return <EmptyState message="Sin sprint activo" />;
 */
export function useActiveSprint(projectId: string | null): UseActiveSprintResult {
  const { data, loading, error, refetch } = useQuery<any>(GET_ACTIVE_SPRINT, {
    variables: { projectId },
    // Omitir la query hasta tener un projectId válido para evitar un error de GraphQL
    skip: !projectId,
  });

  // Extraer el sprint del resultado; null si la query no ha ejecutado o no hay sprint
  const sprint: Sprint | null = data?.activeSprint ?? null;
  // Las historias viven dentro del sprint; array vacío como valor por defecto seguro
  const stories: UserStory[] = sprint?.userStories ?? [];

  return { sprint, stories, loading, error, refetch };
}
