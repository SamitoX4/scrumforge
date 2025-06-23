import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { UPDATE_IMPEDIMENT_STATUS, GET_IMPEDIMENTS } from '@/graphql/impediments/impediment.queries';

/**
 * @interface Props
 * @description Props del modal de resolución de impedimentos.
 */
interface Props {
  /**
   * Datos mínimos del impedimento a resolver.
   * Solo se necesita el id (para la mutación) y el título (para mostrarlo en el modal).
   */
  impediment: { id: string; title: string };
  /** ID del proyecto, necesario para refrescar la lista correcta tras la mutación. */
  projectId: string;
  /** Callback para cerrar el modal, invocado al cancelar o al completar la resolución. */
  onClose: () => void;
}

/**
 * @component ResolveImpedimentModal
 * @description Modal para cerrar un impedimento documentando la solución aplicada.
 *
 * Aparece cuando el Scrum Master o responsable hace clic en "Resolver" sobre un impedimento
 * en estado IN_PROGRESS. Requiere un comentario obligatorio que describe cómo se eliminó
 * el bloqueo, garantizando que el conocimiento de la solución quede registrado.
 *
 * El comentario es obligatorio por diseño: fuerza la documentación del aprendizaje
 * para que el equipo pueda consultarlo en retrospectivas futuras y evitar recurrencias.
 *
 * Tras la resolución:
 * - El estado del impedimento pasa a RESOLVED en el servidor.
 * - Se refresca la lista de impedimentos del proyecto para reflejar el cambio.
 * - El modal se cierra automáticamente mediante `onCompleted`.
 *
 * @param {Props} props
 * @returns {JSX.Element} Modal con formulario de comentario de resolución.
 */
export function ResolveImpedimentModal({ impediment, projectId, onClose }: Props) {
  const [comment, setComment] = useState('');

  const [resolve, { loading }] = useMutation<any>(UPDATE_IMPEDIMENT_STATUS, {
    refetchQueries: [{ query: GET_IMPEDIMENTS, variables: { projectId } }],
    onCompleted: onClose,
  });

  /**
   * Envía la mutación de resolución con el comentario documentado.
   * Previene el comportamiento por defecto del formulario y valida que el comentario
   * no esté vacío antes de llamar al backend.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    resolve({ variables: { id: impediment.id, status: 'RESOLVED', resolvedComment: comment.trim() } });
  };

  return (
    <Modal isOpen title="Resolver impedimento" onClose={onClose} size="sm">
      {/* Mostrar el título del impedimento como recordatorio de contexto para el usuario */}
      <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#475569' }}>
        <strong>{impediment.title}</strong>
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Comentario de resolución *
          </label>
          {/* autoFocus en el textarea para que el usuario pueda escribir de inmediato sin clic extra */}
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Describe cómo se resolvió el impedimento..."
            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
            required
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          {/* Deshabilitado si el comentario está vacío o durante la mutación en vuelo */}
          <Button variant="primary" type="submit" disabled={!comment.trim() || loading}>
            {loading ? 'Resolviendo...' : 'Marcar como resuelto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
