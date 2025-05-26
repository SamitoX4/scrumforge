import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { Input } from '@/components/atoms/Input/Input';
import { UPDATE_BOARD_COLUMNS } from '@/graphql/board/board.mutations';
import { GET_BOARD_COLUMNS } from '@/graphql/board/board.queries';
import { useUIStore } from '@/store/ui.store';
import styles from './ManageColumnsModal.module.scss';

/**
 * Configuración editable de una columna del tablero.
 * Replica la estructura del tipo del servidor para poder mutar el array local
 * antes de enviarlo.
 */
interface BoardColumn {
  id: string;
  title: string;
  status: string;
  color?: string | null;
  order: number;
  wipLimit?: number | null;
}

/**
 * Props del modal de gestión de columnas.
 */
interface ManageColumnsModalProps {
  projectId: string;
  /** Columnas actuales del tablero, en el orden en que se muestran */
  columns: BoardColumn[];
  onClose: () => void;
}

/**
 * Colores por defecto para los estados estándar del tablero.
 * Se usan cuando una columna no tiene color personalizado guardado,
 * evitando que aparezcan columnas sin indicador de color en el header.
 */
const DEFAULT_COLORS: Record<string, string> = {
  TODO: '#6B7280',
  IN_PROGRESS: '#3B82F6',
  IN_REVIEW: '#8B5CF6',
  DONE: '#10B981',
};

/**
 * @component ManageColumnsModal
 * @description Modal para personalizar las columnas del tablero Kanban del proyecto.
 * Permite editar nombre, color e indicador WIP de cada columna, y reordenarlas
 * mediante botones ▲/▼.
 *
 * El estado local (`local`) es una copia mutable de las columnas recibidas por props.
 * Los cambios solo se persisten al pulsar "Guardar cambios", lo que evita actualizaciones
 * parciales si el usuario cancela a mitad de edición.
 *
 * El campo WIP (Work In Progress) límita cuántas tarjetas puede haber simultáneamente
 * en una columna; null significa sin límite y se muestra como placeholder vacío.
 *
 * @param props.projectId - ID del proyecto para invalidar la caché de columnas tras guardar
 * @param props.columns - Configuración actual de columnas (viene de GET_BOARD_COLUMNS)
 * @param props.onClose - Callback al cerrar o después de guardar exitosamente
 */
export function ManageColumnsModal({ projectId, columns, onClose }: ManageColumnsModalProps) {
  const { addToast } = useUIStore();

  // Ordenamos al inicializar para garantizar el orden correcto independientemente
  // de cómo el servidor devuelva las columnas
  const [local, setLocal] = useState<BoardColumn[]>(
    [...columns].sort((a, b) => a.order - b.order),
  );

  const [updateBoardColumns, { loading }] = useMutation<any>(UPDATE_BOARD_COLUMNS, {
    refetchQueries: [{ query: GET_BOARD_COLUMNS, variables: { projectId } }],
    onCompleted: () => {
      addToast('Columnas actualizadas correctamente', 'success');
      onClose();
    },
    onError: (err) => {
      addToast(err.message, 'error');
    },
  });

  /**
   * Aplica cambios parciales a una columna concreta del array local.
   * Usa el índice como clave en lugar del ID para simplificar el acceso
   * al elemento correcto tras posibles reordenaciones.
   *
   * @param index - Posición en el array `local`
   * @param changes - Campos a sobrescribir (spread sobre la columna existente)
   */
  function patch(index: number, changes: Partial<BoardColumn>) {
    setLocal((prev) => prev.map((col, i) => (i === index ? { ...col, ...changes } : col)));
  }

  /**
   * Sube una columna una posición en el orden visual.
   * Intercambia los elementos adyacentes y recalcula el campo `order`
   * para que coincida con el índice del array (0-based).
   */
  function moveUp(index: number) {
    if (index === 0) return;
    setLocal((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      // Recalculamos `order` para que siempre refleje la posición real
      return next.map((col, i) => ({ ...col, order: i }));
    });
  }

  /**
   * Baja una columna una posición en el orden visual.
   * Mismo principio que `moveUp` pero en dirección contraria.
   */
  function moveDown(index: number) {
    if (index === local.length - 1) return;
    setLocal((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((col, i) => ({ ...col, order: i }));
    });
  }

  /**
   * Persiste la configuración de columnas en el servidor.
   * Si el título está vacío, usa el estado como nombre de fallback
   * para garantizar que ninguna columna quede sin etiqueta.
   * El color cae en cascada: personalizado → default por status → gris neutro.
   */
  async function handleSave() {
    await updateBoardColumns({
      variables: {
        projectId,
        columns: local.map((col, i) => ({
          id: col.id,
          // Fallback al status (ej. "IN_PROGRESS") si el título fue borrado
          title: col.title.trim() || col.status,
          status: col.status,
          color: col.color ?? DEFAULT_COLORS[col.status] ?? '#6B7280',
          order: i,
          wipLimit: col.wipLimit ?? null,
        })),
      },
    });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Gestionar columnas del tablero"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <p className={styles.hint}>
        Edita el nombre, color y límite WIP de cada columna. El orden se puede cambiar con los botones ▲ ▼.
      </p>

      <div className={styles.list}>
        {local.map((col, i) => (
          <div key={col.id} className={styles.row}>
            <div className={styles.orderBtns}>
              <button
                className={styles.orderBtn}
                onClick={() => moveUp(i)}
                disabled={i === 0}
                aria-label="Mover arriba"
              >
                ▲
              </button>
              <button
                className={styles.orderBtn}
                onClick={() => moveDown(i)}
                disabled={i === local.length - 1}
                aria-label="Mover abajo"
              >
                ▼
              </button>
            </div>

            <input
              type="color"
              className={styles.colorPicker}
              value={col.color ?? DEFAULT_COLORS[col.status] ?? '#6B7280'}
              onChange={(e) => patch(i, { color: e.target.value })}
              aria-label={`Color de ${col.title}`}
            />

            <div className={styles.titleField}>
              <Input
                value={col.title}
                onChange={(e) => patch(i, { title: e.target.value })}
                aria-label={`Nombre de columna ${i + 1}`}
              />
            </div>

            <div className={styles.wipField}>
              <Input
                type="number"
                min={1}
                max={50}
                value={col.wipLimit ?? ''}
                onChange={(e) => patch(i, { wipLimit: e.target.value ? Number(e.target.value) : null })}
                placeholder="WIP"
                aria-label={`Límite WIP de ${col.title}`}
              />
            </div>

            <span className={styles.statusTag}>{col.status}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
