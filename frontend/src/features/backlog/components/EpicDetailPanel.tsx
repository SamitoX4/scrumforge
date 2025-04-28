import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@apollo/client/react';
import { UPDATE_EPIC } from '@/graphql/backlog/backlog.mutations';
import { GET_EPICS } from '@/graphql/backlog/backlog.queries';
import { Button } from '@/components/atoms/Button/Button';
import { Badge } from '@/components/atoms/Badge/Badge';
import { useUIStore } from '@/store/ui.store';
import type { Epic, Priority } from '@/types/api.types';
import styles from './EpicDetailPanel.module.scss';

/**
 * Paleta de colores predefinidos para asignar a las épicas.
 * Cubre distintas familias de color para diferenciarlas visualmente en el backlog.
 */
const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#64748b',
];

/** Opciones de prioridad con etiquetas en español para el selector. */
const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: 'CRITICAL', label: 'Crítica' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'LOW', label: 'Baja' },
];

/**
 * Props del componente EpicDetailPanel.
 */
interface EpicDetailPanelProps {
  /** Épica seleccionada. Si es `null` el panel se cierra. */
  epic: Epic | null;
  /** ID del proyecto para invalidar el caché de épicas tras guardar. */
  projectId: string;
  /** Callback para cerrar el panel. */
  onClose: () => void;
}

/**
 * EpicDetailPanel
 *
 * Panel lateral deslizante (slide-over) que muestra y permite editar
 * los detalles de una épica: título, prioridad, color y descripción.
 *
 * Funcionamiento del guardado:
 * - Los cambios en título y descripción marcan el panel como "sucio" (`isDirty`).
 * - Al hacer `onBlur` en cualquier campo de texto se guarda automáticamente
 *   si hay cambios pendientes, lo que evita que el usuario tenga que recordar
 *   pulsar "Guardar" para cada pequeño ajuste.
 * - El botón "Guardar" explícito también está disponible en la cabecera.
 * - Cambios de prioridad y color llaman directamente a `setIsDirty(true)` y
 *   esperan al guardado manual o al blur del siguiente campo.
 *
 * Accesibilidad:
 * - La tecla Escape cierra el panel.
 * - Un backdrop semitransparente cierra el panel al hacer clic fuera de él.
 * - El panel se renderiza en un portal sobre `document.body` para evitar
 *   problemas de stacking context con el resto del layout.
 *
 * @param epic - Épica a editar. `null` oculta el panel.
 * @param projectId - Necesario para refrescar la lista de épicas tras guardar.
 * @param onClose - Función que cierra el panel.
 */
export function EpicDetailPanel({ epic, projectId, onClose }: EpicDetailPanelProps) {
  const { addToast } = useUIStore();
  // `isOpen` controla los efectos secundarios (keydown listener, etc.)
  const isOpen = !!epic;

  // Estado local de edición — se sincroniza desde `epic` cuando cambia la selección
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  // Bandera para saber si hay cambios no guardados
  const [isDirty, setIsDirty] = useState(false);

  const [updateEpic, { loading: saving }] = useMutation<any>(UPDATE_EPIC, {
    // Invalida el caché de épicas para que el listado se actualice sin refetch manual
    refetchQueries: [{ query: GET_EPICS, variables: { projectId } }],
  });

  /**
   * Sincroniza los campos del formulario cuando cambia la épica seleccionada.
   * Se observa `epic?.id` (no el objeto completo) para evitar re-renders
   * provocados por referencias nuevas del objeto con los mismos valores.
   */
  useEffect(() => {
    if (epic) {
      setTitle(epic.title);
      setDescription(epic.description ?? '');
      setPriority(epic.priority);
      setColor(epic.color);
      setIsDirty(false);
    }
  }, [epic?.id]);

  /**
   * Registra el listener de teclado para cerrar con Escape.
   * Se limpia al desmontar o cuando el panel se cierra para no acumular listeners.
   */
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  /** Envía los cambios al servidor y resetea la bandera `isDirty`. */
  async function handleSave() {
    if (!epic || !title.trim()) return;
    try {
      await updateEpic({
        variables: {
          id: epic.id,
          input: { title: title.trim(), description: description.trim() || null, priority, color },
        },
      });
      setIsDirty(false);
      addToast('Épica actualizada', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    }
  }

  /**
   * Guardado automático al perder el foco en los campos de texto.
   * Solo guarda si hay cambios reales para no hacer llamadas innecesarias.
   */
  function handleTitleBlur() {
    if (isDirty) handleSave();
  }

  /**
   * Actualiza la prioridad seleccionada y marca el formulario como sucio
   * para que el botón "Guardar" aparezca en la cabecera del panel.
   *
   * @param value - Nueva prioridad seleccionada.
   */
  function handlePriorityChange(value: Priority) {
    setPriority(value);
    setIsDirty(true);
  }

  /**
   * Actualiza el color de la épica y marca el formulario como sucio.
   * Funciona tanto con los colores predefinidos como con el input nativo de color.
   *
   * @param value - Código hexadecimal del nuevo color (p.ej. `'#6366f1'`).
   */
  function handleColorChange(value: string) {
    setColor(value);
    setIsDirty(true);
  }

  // No renderizar nada si no hay épica seleccionada
  if (!isOpen) return null;

  // Portal para superponer el panel por encima de toda la jerarquía de stacking
  return createPortal(
    <>
      {/* Backdrop semitransparente — cerrar al hacer clic fuera del panel */}
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.panel} role="complementary" aria-label="Detalle de épica">
        {/* Cabecera del panel con botón de guardar (si hay cambios) y botón de cierre */}
        <div className={styles.panelHeader}>
          <span className={styles.panelLabel}>Épica</span>
          <div className={styles.panelActions}>
            {isDirty && (
              <Button size="sm" onClick={handleSave} loading={saving}>
                Guardar
              </Button>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar panel">
              ✕
            </button>
          </div>
        </div>

        {/* Cuerpo del panel con los campos de edición */}
        <div className={styles.body}>
          {/* Franja de color + campo de título */}
          <div className={styles.titleRow}>
            {/* Indicador visual del color seleccionado para la épica */}
            <span className={styles.colorStrip} style={{ backgroundColor: color }} />
            <textarea
              className={styles.titleInput}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
              onBlur={handleTitleBlur}
              rows={2}
              placeholder="Título de la épica"
            />
          </div>

          {/* Campos de metadatos: prioridad y color */}
          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Prioridad</span>
              <select
                className={styles.metaSelect}
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value as Priority)}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {/* Badge de vista previa de la prioridad seleccionada */}
              <Badge variant={priority}>{priority}</Badge>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Color</span>
              <div className={styles.colorPicker}>
                {/* Muestras de colores predefinidos */}
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={styles.colorSwatch}
                    style={{ backgroundColor: c }}
                    data-selected={color === c || undefined}
                    onClick={() => handleColorChange(c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
                {/* Input de color nativo para elegir un color personalizado */}
                <input
                  type="color"
                  className={styles.colorCustom}
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  title="Color personalizado"
                />
              </div>
            </div>
          </div>

          {/* Sección de descripción con guardado automático al perder el foco */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Descripción</h3>
            <textarea
              className={styles.descriptionInput}
              value={description}
              onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
              onBlur={handleTitleBlur}
              placeholder="Añade una descripción para esta épica..."
              rows={5}
            />
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
