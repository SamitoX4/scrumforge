import { useState, useMemo } from 'react';
import { StatusBadge, PriorityBadge } from '@/components/atoms/Badge/Badge';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import type { UserStory } from '@/types/api.types';

/** Columnas por las que se puede ordenar la tabla. */
type SortKey = 'title' | 'status' | 'priority' | 'points' | 'epic' | 'sprint' | 'assignee';

/** Dirección del ordenamiento. */
type SortDir = 'asc' | 'desc';

/**
 * Pesos numéricos para ordenar prioridades de mayor a menor urgencia.
 * Valores más bajos indican mayor urgencia (CRITICAL = 0).
 */
const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Pesos numéricos para ordenar estados según flujo de trabajo habitual.
 * TODO → IN_PROGRESS → IN_REVIEW → DONE.
 */
const STATUS_ORDER: Record<string, number> = { TODO: 0, IN_PROGRESS: 1, IN_REVIEW: 2, DONE: 3 };

/**
 * Props del componente BacklogFlatList.
 */
interface BacklogFlatListProps {
  /** Historias de usuario a mostrar en la tabla. */
  stories: UserStory[];
  /** Callback al hacer clic en una fila para abrir el panel de detalle. */
  onSelectStory: (id: string) => void;
}

/**
 * BacklogFlatList
 *
 * Vista tabular del backlog con ordenamiento client-side por cualquier columna.
 * Al hacer clic en una cabecera de columna se ordena; un segundo clic invierte el orden.
 * El icono ↑/↓ indica la columna activa y su dirección; ↕ indica columnas inactivas.
 *
 * El ordenamiento se recalcula con `useMemo` solo cuando cambian `stories`,
 * `sortKey` o `sortDir`, evitando renders innecesarios.
 *
 * @param stories - Historias a mostrar y ordenar.
 * @param onSelectStory - Función para abrir el detalle de una historia.
 */
export function BacklogFlatList({ stories, onSelectStory }: BacklogFlatListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /**
   * Gestiona el clic en una cabecera de columna.
   * Si se hace clic en la columna activa, invierte la dirección.
   * Si se hace clic en otra columna, la activa con dirección ascendente.
   */
  function handleHeaderClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  /**
   * Calcula el array ordenado a partir de la copia de `stories`.
   * Se usa una copia para no mutar los props.
   * Los valores nulos/vacíos se envían al final asignándoles un peso 99 o cadena vacía.
   */
  const sorted = useMemo(() => {
    const clone = [...stories];
    clone.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'status':
          // Ordenar según flujo de trabajo, no alfabéticamente
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case 'priority':
          // Ordenar de mayor a menor urgencia usando los pesos definidos
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case 'points':
          // Historias sin puntos (-1) van al final en orden ascendente
          cmp = (a.points ?? -1) - (b.points ?? -1);
          break;
        case 'epic':
          cmp = (a.epic?.title ?? '').localeCompare(b.epic?.title ?? '');
          break;
        case 'sprint':
          cmp = (a.sprint?.name ?? '').localeCompare(b.sprint?.name ?? '');
          break;
        case 'assignee':
          cmp = (a.assignee?.name ?? '').localeCompare(b.assignee?.name ?? '');
          break;
      }
      // Invertir el resultado si la dirección es descendente
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return clone;
  }, [stories, sortKey, sortDir]);

  /**
   * Icono de indicación de ordenamiento para una columna dada.
   * Muestra ↑ o ↓ si es la columna activa, y ↕ si no lo es.
   */
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ color: 'var(--color-text-disabled)', marginLeft: '4px' }}>↕</span>;
    return <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  /** Estilos compartidos para todas las celdas de cabecera de la tabla. */
  const thStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid var(--color-border)',
  };

  // Estado vacío cuando no hay historias que mostrar
  if (stories.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        No hay historias que mostrar.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: 'var(--color-surface-raised)' }}>
            <th style={{ ...thStyle, width: '40%' }} onClick={() => handleHeaderClick('title')}>
              Título <SortIcon col="title" />
            </th>
            <th style={thStyle} onClick={() => handleHeaderClick('status')}>
              Estado <SortIcon col="status" />
            </th>
            <th style={thStyle} onClick={() => handleHeaderClick('priority')}>
              Prioridad <SortIcon col="priority" />
            </th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleHeaderClick('points')}>
              Pts <SortIcon col="points" />
            </th>
            <th style={thStyle} onClick={() => handleHeaderClick('epic')}>
              Épica <SortIcon col="epic" />
            </th>
            <th style={thStyle} onClick={() => handleHeaderClick('sprint')}>
              Sprint <SortIcon col="sprint" />
            </th>
            <th style={thStyle} onClick={() => handleHeaderClick('assignee')}>
              Asignado <SortIcon col="assignee" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((story, idx) => (
            <tr
              key={story.id}
              onClick={() => onSelectStory(story.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectStory(story.id)}
              tabIndex={0}
              role="button"
              style={{
                cursor: 'pointer',
                // Filas alternas con fondo ligeramente diferente para facilitar la lectura
                background: idx % 2 === 0 ? 'transparent' : 'var(--color-surface-raised, rgba(0,0,0,0.02))',
                borderBottom: '1px solid var(--color-border)',
                transition: 'background 0.1s',
              }}
              // Efecto hover manual porque las filas de tabla no admiten CSS Modules fácilmente
              onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? 'transparent' : 'var(--color-surface-raised, rgba(0,0,0,0.02))'; }}
            >
              <td style={{ padding: '0.5rem 0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Punto de color de la épica asociada a la historia */}
                  {story.epic && (
                    <span
                      style={{ width: '8px', height: '8px', borderRadius: '50%', background: story.epic.color, flexShrink: 0 }}
                      title={story.epic.title}
                    />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {story.title}
                  </span>
                </div>
              </td>
              <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                <StatusBadge status={story.status} />
              </td>
              <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                <PriorityBadge priority={story.priority} />
              </td>
              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                {/* Guión largo cuando la historia no tiene puntos estimados */}
                {story.points ?? '—'}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                {story.epic?.title ?? <span style={{ opacity: 0.4 }}>—</span>}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                {story.sprint?.name ?? <span style={{ opacity: 0.4 }}>Sin sprint</span>}
              </td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                {story.assignee ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Avatar name={story.assignee.name} avatarUrl={story.assignee.avatarUrl} size="xs" />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{story.assignee.name}</span>
                  </div>
                ) : (
                  <span style={{ opacity: 0.4, fontSize: '0.8125rem' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
