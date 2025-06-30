import { useQuery } from '@apollo/client/react';
import { GET_AUDIT_LOG } from '@/graphql/audit/audit.queries';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

/**
 * Props de ActivityTab.
 * @property entityId - ID de la entidad cuyo log de auditoría se quiere mostrar.
 * @property entityType - Tipo de entidad (por defecto 'UserStory').
 *   El backend usa este valor para filtrar el log correcto.
 */
interface Props {
  entityId: string;
  entityType?: string;
}

/**
 * Etiquetas legibles en español para cada tipo de acción de auditoría.
 * Permite mostrar texto natural en lugar de los valores internos del backend.
 */
const ACTION_LABELS: Record<string, string> = {
  CREATED: 'creó',
  DELETED: 'eliminó',
  STATUS_CHANGED: 'cambió estado',
  FIELD_UPDATED: 'actualizó',
  ASSIGNED: 'reasignó',
};

/**
 * Etiquetas legibles para los campos que pueden cambiar en una entidad.
 * Si el campo no está en este mapa, se muestra tal cual viene del backend.
 */
const FIELD_LABELS: Record<string, string> = {
  status: 'estado',
  title: 'título',
  description: 'descripción',
  priority: 'prioridad',
  points: 'puntos',
  assigneeId: 'asignado',
  epicId: 'épica',
  sprintId: 'sprint',
};

/**
 * Formatea el valor de un campo del log de auditoría para su presentación.
 * - Devuelve '(vacío)' para valores nulos, 'null' o 'undefined' (cadenas del backend).
 * - Para el campo 'status', traduce el valor DB (TODO, IN_PROGRESS…) a español.
 * - Para el resto de campos, devuelve el valor tal cual.
 *
 * @param field - Nombre del campo modificado (puede ser null si la acción no tiene campo).
 * @param value - Valor string del campo, tal como llega del backend.
 */
function formatValue(field: string | null | undefined, value: string | null | undefined) {
  if (!value || value === 'null' || value === 'undefined') return '(vacío)';
  if (field === 'status') {
    const map: Record<string, string> = { TODO: 'Por hacer', IN_PROGRESS: 'En progreso', IN_REVIEW: 'En revisión', DONE: 'Listo' };
    return map[value] ?? value;
  }
  return value;
}

/**
 * Pestaña de Actividad (Auditoría).
 *
 * Muestra el historial de cambios de una entidad (p.ej. una historia de usuario)
 * en orden cronológico inverso. Cada entrada incluye el usuario que realizó la
 * acción, el tipo de cambio, y los valores anterior y nuevo cuando aplica.
 *
 * Se limita a los últimos 50 eventos para mantener la respuesta ágil.
 * El avatar del usuario se sustituye por un círculo con su inicial para evitar
 * dependencias de almacenamiento de imágenes.
 */
export function ActivityTab({ entityId, entityType = 'UserStory' }: Props) {
  const { data, loading } = useQuery<any>(GET_AUDIT_LOG, {
    variables: { entityId, entityType, limit: 50 },
  });

  const entries = data?.auditLog ?? [];

  if (loading) return <div style={{ padding: '1rem' }}><Spinner size="sm" /></div>;

  if (entries.length === 0) {
    return <p style={{ color: '#94A3B8', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>Sin actividad registrada.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {entries.map((entry: { id: string; action: string; field?: string; oldValue?: string; newValue?: string; createdAt: string; user: { name: string } }) => (
        <div key={entry.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', fontSize: '0.82rem' }}>
          {/* Avatar con inicial del nombre — evita dependencia de URLs de imagen */}
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
            {entry.user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, color: '#1E293B' }}>{entry.user.name}</span>
            {' '}
            <span style={{ color: '#475569' }}>
              {/* Construir la descripción legible de la acción según los datos disponibles */}
              {ACTION_LABELS[entry.action] ?? entry.action}
              {entry.field ? ` ${FIELD_LABELS[entry.field] ?? entry.field}` : ''}
              {entry.oldValue && entry.newValue ? (
                // Cambio de un valor a otro: "cambió estado de Por hacer a En progreso"
                <> de <em>{formatValue(entry.field, entry.oldValue)}</em> a <em>{formatValue(entry.field, entry.newValue)}</em></>
              ) : entry.newValue ? (
                // Solo nuevo valor: "actualizó título → Mi nueva historia"
                <> → <em>{formatValue(entry.field, entry.newValue)}</em></>
              ) : null}
            </span>
            {/* Fecha localizada en español para consistencia con el resto de la app */}
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginTop: 2 }}>
              {new Date(entry.createdAt).toLocaleString('es')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
