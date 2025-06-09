/**
 * @file useNotifications.ts
 * @description Hook que suscribe al usuario a notificaciones en tiempo real vía WebSocket.
 *
 * Se monta una única vez en `WorkspaceLayout` (App.tsx) para toda la sesión,
 * garantizando que el usuario reciba notificaciones en cualquier página de la app
 * sin necesidad de montar la suscripción en cada componente individual.
 *
 * Cuando llega una notificación, extrae el mensaje del campo `payload` (JSON) y lo
 * muestra como toast informativo. El payload malformado se ignora silenciosamente
 * para no interrumpir la experiencia del usuario.
 *
 * La suscripción solo está activa cuando hay un usuario autenticado (`skip: !user`),
 * lo que evita conexiones WebSocket innecesarias en páginas públicas.
 */
import { useSubscription } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { NOTIFICATION_ADDED } from '@/graphql/subscriptions/board.subscriptions';

/**
 * Hook que muestra un toast por cada notificación en tiempo real recibida.
 *
 * No devuelve nada — su efecto es puramente de side-effect (mostrar toasts).
 * Montar este hook solo una vez a nivel de layout para toda la sesión.
 *
 * @example
 * // En WorkspaceLayout:
 * useNotifications(); // activo para toda la sesión protegida
 */
export function useNotifications(): void {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  useSubscription<any>(NOTIFICATION_ADDED, {
    // No suscribir si no hay sesión activa — evita conexiones WS en páginas públicas
    skip: !user,
    onData: ({ data }) => {
      const notification = data.data?.notificationAdded as
        | { type: string; payload?: string | null }
        | undefined;

      // Ignorar eventos vacíos o malformados del servidor
      if (!notification) return;

      try {
        // El campo `payload` es un JSON serializado que puede contener un campo `message`
        const payload = JSON.parse(notification.payload ?? '{}') as { message?: string };
        if (payload.message) {
          // Mostrar el mensaje como toast informativo al usuario
          addToast(payload.message, 'info');
        }
      } catch {
        // Payload JSON inválido — ignorar silenciosamente para no interrumpir la UI
      }
    },
  });
}
