import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { UNBLOCK_STORY } from '@/graphql/backlog/backlog.mutations';
import { GET_ACTIVE_SPRINT } from '@/graphql/sprint/sprint.queries';
import { useUIStore } from '@/store/ui.store';
import styles from './BlockStoryModal.module.scss';

/**
 * Props del modal de desbloqueo de historia.
 */
interface UnblockStoryModalProps {
  storyId: string;
  storyTitle: string;
  /** Motivo original del bloqueo, se muestra como referencia para el equipo */
  blockedReason?: string | null;
  projectId: string;
  onClose: () => void;
}

/**
 * @component UnblockStoryModal
 * @description Modal para registrar la resolución de un bloqueo en una historia
 * de usuario del tablero. Requiere un comentario obligatorio describiendo cómo
 * se resolvió el impedimento, lo que genera trazabilidad en el historial de la historia.
 *
 * Muestra el motivo original del bloqueo como referencia para que el usuario
 * pueda contextualizar su comentario de resolución. El comentario vacío deshabilita
 * el botón de confirmación para evitar registros sin información útil.
 *
 * Al desbloquear, se invalida la query GET_ACTIVE_SPRINT para refrescar los
 * indicadores de bloqueo en las tarjetas del tablero.
 *
 * @param props.storyId - ID de la historia a desbloquear
 * @param props.storyTitle - Título mostrado como contexto visual en el modal
 * @param props.blockedReason - Motivo del bloqueo original (puede ser null si no se registró)
 * @param props.projectId - ID del proyecto para invalidar la caché del sprint
 * @param props.onClose - Callback al cerrar o tras desbloquear exitosamente
 */
export function UnblockStoryModal({
  storyId,
  storyTitle,
  blockedReason,
  projectId,
  onClose,
}: UnblockStoryModalProps) {
  const [comment, setComment] = useState('');
  const { addToast } = useUIStore();

  // Al desbloquear refrescamos el sprint activo para que las tarjetas
  // eliminen el indicador visual de bloqueo en el tablero
  const [unblockStory, { loading }] = useMutation<any>(UNBLOCK_STORY, {
    refetchQueries: [{ query: GET_ACTIVE_SPRINT, variables: { projectId } }],
  });

  /**
   * Envía la mutación de desbloqueo con el comentario de resolución.
   * El comentario es obligatorio para mantener trazabilidad del impedimento.
   */
  async function handleSubmit() {
    if (!comment.trim()) return;
    try {
      await unblockStory({ variables: { id: storyId, comment: comment.trim() } });
      addToast('Historia desbloqueada', 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al desbloquear historia', 'error');
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Resolver bloqueo"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={!comment.trim()}
          >
            Desbloquear
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        <p className={styles.storyTitle}>{storyTitle}</p>
        {blockedReason && (
          <div className={styles.field}>
            <span className={styles.label}>Motivo del bloqueo</span>
            <p className={styles.storyTitle} style={{ borderLeftColor: '#6B7280' }}>{blockedReason}</p>
          </div>
        )}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="unblock-comment">
            Cómo se resolvió <span className={styles.required}>*</span>
          </label>
          <textarea
            id="unblock-comment"
            className={styles.textarea}
            placeholder="Describe cómo se resolvió el bloqueo..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
}
