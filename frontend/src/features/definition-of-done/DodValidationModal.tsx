import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { GET_DOD_ITEMS } from '@/graphql/dod/dod.queries';

/**
 * @interface Props
 * @description Props del modal de validación de la Definition of Done.
 */
interface Props {
  /** ID del proyecto del que se cargan los criterios DoD. */
  projectId: string;
  /** Título de la historia de usuario que se intenta mover a "Done". */
  storyTitle: string;
  /**
   * Callback invocado al confirmar el movimiento a Done.
   * @param override - `true` si el usuario está forzando el paso con criterios sin marcar
   *   (se registrará en auditoría), `false` si todos los criterios estaban cumplidos.
   */
  onConfirm: (override: boolean) => void;
  /** Callback invocado al cancelar el modal sin ninguna acción. */
  onCancel: () => void;
}

/**
 * @component DodValidationModal
 * @description Modal de verificación de la Definition of Done antes de completar una historia.
 *
 * Se muestra en el flujo de mover una historia al estado "Done" en el tablero Kanban.
 * Su propósito es garantizar que el equipo revise activamente los criterios de calidad
 * acordados antes de dar por terminado un ítem de trabajo.
 *
 * Comportamiento según el estado de los criterios:
 * - **Sin criterios DoD definidos**: confirma automáticamente con `override=false` y
 *   no renderiza el modal, evitando fricción innecesaria en proyectos que aún no han
 *   configurado su DoD.
 * - **Todos marcados**: el botón "Confirmar Done" está disponible con `override=false`.
 * - **Alguno sin marcar**: se muestra una advertencia y aparece el botón "Continuar con
 *   override" que llama a `onConfirm(true)`, señalando que se debe registrar el bypass
 *   en el log de auditoría del backend.
 *
 * El estado de los checkboxes es local al modal y no persiste entre aperturas,
 * obligando a una revisión consciente cada vez que se intenta completar una historia.
 *
 * @param {Props} props
 * @returns {JSX.Element | null} Modal de validación, o null mientras carga o si no hay criterios.
 */
export function DodValidationModal({ projectId, storyTitle, onConfirm, onCancel }: Props) {
  const { data, loading } = useQuery<any>(GET_DOD_ITEMS, { variables: { projectId } });
  const items: { id: string; text: string }[] = data?.dodItems ?? [];

  // Mapa de id -> boolean para rastrear qué criterios ha marcado el usuario.
  // Se inicializa vacío (ninguno marcado) para forzar revisión activa.
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Verdadero cuando no hay criterios O cuando todos están marcados
  const allChecked = items.length === 0 || items.every((it) => checked[it.id]);
  // Verdadero cuando al menos un criterio está sin marcar (determina si mostrar la advertencia)
  const anyUnchecked = items.some((it) => !checked[it.id]);

  /**
   * Alterna el estado de un criterio individual en el mapa de checks.
   * Se usa spread del estado previo para mantener la inmutabilidad del estado de React.
   */
  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  // No renderizar mientras se cargan los criterios para evitar un flash de contenido vacío
  if (loading) return null;

  // Cortocircuito: si el proyecto no tiene DoD configurada, confirmar de inmediato
  // sin mostrar el modal para no interrumpir el flujo del usuario innecesariamente.
  if (items.length === 0) {
    onConfirm(false);
    return null;
  }

  return (
    <Modal isOpen title="Definition of Done" onClose={onCancel} size="sm">
      <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#475569' }}>
        Antes de mover <strong>{storyTitle}</strong> a Done, verifica los criterios:
      </p>

      {/* Lista de criterios interactivos: el clic en el li o en el checkbox los alterna */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items.map((item) => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
              onClick={() => toggle(item.id)}>
            <input type="checkbox" checked={!!checked[item.id]} onChange={() => toggle(item.id)} />
            {/* El texto tacha y se colorea en verde cuando el criterio está marcado */}
            <span style={{ fontSize: '0.875rem', color: checked[item.id] ? '#16A34A' : '#1E293B', textDecoration: checked[item.id] ? 'line-through' : 'none' }}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>

      {/* Advertencia condicional: solo visible si hay criterios pendientes,
          informa al usuario de las implicaciones del override (auditoría). */}
      {anyUnchecked && (
        <p style={{ fontSize: '0.8rem', color: '#DC2626', marginBottom: '1rem' }}>
          ⚠ Hay criterios sin marcar. Puedes continuar con override (se registrará tu nombre y la fecha).
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        {/* El botón de override solo aparece cuando hay algo sin marcar,
            evitando que el usuario lo use si ya todo está cumplido. */}
        {!allChecked && (
          <Button variant="secondary" onClick={() => onConfirm(true)}>
            Continuar con override
          </Button>
        )}
        {/* El botón principal permanece deshabilitado mientras existan criterios sin marcar,
            forzando a usar el override como acción explícita y consciente. */}
        <Button variant="primary" onClick={() => onConfirm(false)} disabled={anyUnchecked}>
          Confirmar Done
        </Button>
      </div>
    </Modal>
  );
}
