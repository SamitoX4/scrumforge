import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { BLOCK_STORY } from '@/graphql/backlog/backlog.mutations';
import { GET_ACTIVE_SPRINT } from '@/graphql/sprint/sprint.queries';
import { useUIStore } from '@/store/ui.store';
import styles from './BlockStoryModal.module.scss';

/**
 * Props del componente BlockStoryModal.
 */
interface BlockStoryModalProps {
  /** ID de la historia a bloquear. */
  storyId: string;
  /** Título de la historia, mostrado como contexto en el modal. */
  storyTitle: string;
  /** ID del proyecto, necesario para refrescar el sprint activo tras el bloqueo. */
  projectId: string;
  /** Callback para cerrar el modal sin bloquear. */
  onClose: () => void;
}

/**
 * BlockStoryModal
 *
 * Modal para marcar una historia del tablero como bloqueada.
 *
 * El usuario debe proporcionar obligatoriamente el motivo del bloqueo,
 * que queda registrado en la historia para que el equipo sepa qué
 * impide su avance. El botón de confirmación permanece deshabilitado
 * hasta que se introduce al menos un carácter.
 *
 * Tras el bloqueo exitoso se invalida el caché del sprint activo para
 * que el tablero muestre inmediatamente el badge de "bloqueado" en la
 * tarjeta correspondiente.
 *
 * @param storyId - ID de la historia a bloquear.
 * @param storyTitle - Nombre de la historia mostrado como contexto.
 * @param projectId - Proyecto del que se recargará el sprint activo.
 * @param onClose - Cierra el modal.
 */
export function BlockStoryModal({ storyId, storyTitle, projectId, onClose }: BlockStoryModalProps) {
  const [reason, setReason] = useState('');
  const { addToast } = useUIStore();

  const [blockStory, { loading }] = useMutation<any>(BLOCK_STORY, {
    // Refrescar el sprint activo para que el badge de bloqueo aparezca en el tablero
    refetchQueries: [{ query: GET_ACTIVE_SPRINT, variables: { projectId } }],
  });

  /**
   * Envía la mutación de bloqueo con el motivo indicado.
   * El trimeo evita guardar espacios en blanco como motivo válido.
   */
  async function handleSubmit() {
    if (!reason.trim()) return;
    try {
      await blockStory({ variables: { id: storyId, reason: reason.trim() } });
      // Toast de advertencia (warning) porque bloquear una historia es una señal de impedimento
      addToast('Historia marcada como bloqueada', 'warning');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al bloquear historia', 'error');
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Marcar historia como bloqueada"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          {/* El botón de confirmar permanece deshabilitado hasta que hay un motivo */}
          <Button
            variant="danger"
            onClick={handleSubmit}
            loading={loading}
            disabled={!reason.trim()}
          >
            Marcar bloqueada
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        {/* Título de la historia como contexto para que el usuario confirme que es la correcta */}
        <p className={styles.storyTitle}>{storyTitle}</p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="block-reason">
            Motivo del bloqueo <span className={styles.required}>*</span>
          </label>
          {/* autoFocus para que el usuario pueda escribir inmediatamente al abrir el modal */}
          <textarea
            id="block-reason"
            className={styles.textarea}
            placeholder="Describe qué está impidiendo el avance de esta historia..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
}
