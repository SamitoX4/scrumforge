/**
 * @file useBoardRealtime.ts
 * @description Hook que suscribe el tablero a actualizaciones en tiempo real vía WebSocket.
 *
 * Cuando otro usuario mueve una tarjeta, el servidor emite un evento `boardUpdated`.
 * Este hook recibe ese evento y actualiza el caché normalizado de Apollo directamente,
 * sin disparar un refetch completo del sprint. Esto evita el parpadeo de la UI y
 * reduce la carga de red en sesiones colaborativas.
 *
 * Complementa la actualización optimista de `useBoardDnd`:
 * - `useBoardDnd` maneja los cambios del usuario local (vía `optimisticResponse`).
 * - `useBoardRealtime` maneja los cambios de otros usuarios (vía suscripción WebSocket).
 */
import { useSubscription, useApolloClient } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { BOARD_UPDATED } from '@/graphql/subscriptions/board.subscriptions';

/**
 * Fragmento local que define exactamente los campos que trae la suscripción.
 * Se declara aquí (y no en el archivo de suscripciones) porque es un detalle
 * de implementación de la escritura en caché, no parte del contrato de la API.
 *
 * Los campos deben coincidir exactamente con los que devuelve `BOARD_UPDATED`
 * para que Apollo pueda hacer la escritura parcial sin errores de tipo.
 */
const BOARD_STORY_FRAGMENT = gql`
  fragment BoardRealtimeStory on UserStory {
    id
    status
    assigneeId
    points
    sprintId
  }
`;

/**
 * Hook que mantiene el tablero sincronizado con los cambios de otros usuarios.
 *
 * Actualiza el caché normalizado de Apollo con solo los campos cambiados,
 * lo que propaga el cambio a todas las queries que referencien esa historia
 * (GET_ACTIVE_SPRINT, GET_BACKLOG, etc.) sin necesidad de un refetch.
 *
 * @param projectId - ID del proyecto activo. Si es `null`, la suscripción se omite
 *                    para evitar suscripciones huérfanas al navegar entre proyectos.
 *
 * @example
 * // Montar en el componente raíz del tablero:
 * useBoardRealtime(projectId);
 */
export function useBoardRealtime(projectId: string | null): void {
  // Acceso directo al cliente Apollo para escribir en caché sin disparar queries
  const client = useApolloClient();

  useSubscription<any>(BOARD_UPDATED, {
    variables: { projectId },
    // No suscribir hasta tener un projectId válido para evitar errores de GraphQL
    skip: !projectId,
    onData: ({ data }) => {
      const story = data.data?.boardUpdated;
      // Ignorar eventos malformados o sin ID (no se puede identificar el objeto en caché)
      if (!story?.id) return;

      // Escribe solo los campos cambiados en el caché normalizado.
      // Apollo usa `client.cache.identify` para encontrar el objeto correcto
      // usando el sistema de normalización por `__typename + id`.
      // El cambio se propaga automáticamente a todos los componentes que leen
      // esta historia desde el caché, sin necesidad de re-fetch.
      client.cache.writeFragment({
        id: client.cache.identify({ __typename: 'UserStory', id: story.id }),
        fragment: BOARD_STORY_FRAGMENT,
        data: { __typename: 'UserStory', ...story },
      });
    },
  });
}
