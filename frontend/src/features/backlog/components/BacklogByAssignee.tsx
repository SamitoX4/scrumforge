import { useMemo } from 'react';
import { StatusBadge, PriorityBadge } from '@/components/atoms/Badge/Badge';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import type { UserStory } from '@/types/api.types';

/**
 * Props del componente BacklogByAssignee.
 */
interface BacklogByAssigneeProps {
  /** Lista completa de historias de usuario a agrupar. */
  stories: UserStory[];
  /** Identificador del proyecto (reservado para futuros filtros server-side). */
  projectId: string;
  /** Callback invocado al hacer clic en una fila; recibe el id de la historia. */
  onSelectStory: (id: string) => void;
}

/**
 * Representa un grupo de historias asociadas a un mismo responsable.
 */
interface AssigneeGroup {
  /** Clave única: el assigneeId del usuario o '__unassigned__' si no tiene asignado. */
  key: string;
  /** Nombre visible del responsable. */
  name: string;
  /** URL del avatar del responsable (puede ser nula). */
  avatarUrl?: string | null;
  /** Historias que pertenecen a este responsable. */
  stories: UserStory[];
}

/**
 * BacklogByAssignee
 *
 * Agrupa y muestra las historias del backlog por responsable asignado.
 * Las historias sin asignado se ubican al final bajo la etiqueta "Sin asignar".
 *
 * La agrupación se calcula con `useMemo` para evitar recálculos innecesarios
 * cuando cambian propiedades no relacionadas del componente padre.
 *
 * @param stories - Historias de usuario a mostrar agrupadas.
 * @param onSelectStory - Función para abrir el panel de detalle de una historia.
 */
export function BacklogByAssignee({ stories, onSelectStory }: BacklogByAssigneeProps) {
  const groups = useMemo<AssigneeGroup[]>(() => {
    // Construimos un Map para agrupar en un solo recorrido O(n)
    const map = new Map<string, AssigneeGroup>();

    for (const story of stories) {
      // Usamos '__unassigned__' como clave centinela para historias sin asignado
      const key = story.assigneeId ?? '__unassigned__';
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: story.assignee?.name ?? 'Sin asignar',
          avatarUrl: story.assignee?.avatarUrl ?? null,
          stories: [],
        });
      }
      map.get(key)!.stories.push(story);
    }

    // Ordenar: las historias sin asignado siempre al final, el resto alfabéticamente
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === '__unassigned__') return 1;
      if (b.key === '__unassigned__') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [stories]);

  // Estado vacío: no hay historias en el backlog
  if (stories.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        No hay historias en el backlog.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {groups.map((group) => (
        <div key={group.key} style={{ borderRadius: '6px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {/* Cabecera del grupo con avatar (o punto gris si no tiene asignado) y conteo de historias */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.6rem 0.75rem',
              background: 'var(--color-surface-raised)',
              borderBottom: '1px solid var(--color-border)',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            {group.key !== '__unassigned__' ? (
              <Avatar name={group.name} avatarUrl={group.avatarUrl} size="xs" />
            ) : (
              /* Indicador visual discreto para el grupo "Sin asignar" */
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--color-text-secondary)',
                  opacity: 0.35,
                  flexShrink: 0,
                }}
              />
            )}
            <span>{group.name}</span>
            {/* Conteo de historias en el grupo, alineado al extremo derecho */}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.75rem',
                fontWeight: 400,
                color: 'var(--color-text-secondary)',
                background: 'var(--color-surface)',
                borderRadius: '12px',
                padding: '0.1rem 0.5rem',
                border: '1px solid var(--color-border)',
              }}
            >
              {group.stories.length}
            </span>
          </div>

          {/* Filas de historias dentro del grupo */}
          <div>
            {group.stories.map((story) => (
              <div
                key={story.id}
                onClick={() => onSelectStory(story.id)}
                onKeyDown={(e) => e.key === 'Enter' && onSelectStory(story.id)}
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border)',
                  transition: 'background 0.1s',
                }}
                // Efecto hover manual porque no se usa CSS Modules en este componente
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
              >
                {/* Punto de color de la épica asociada a la historia */}
                {story.epic && (
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: story.epic.color,
                      flexShrink: 0,
                    }}
                    title={story.epic.title}
                  />
                )}
                {/* Título truncado con ellipsis si no cabe en una línea */}
                <span style={{ flex: 1, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {story.title}
                </span>
                {/* Metadatos: estado, prioridad y puntos */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <StatusBadge status={story.status} />
                  <PriorityBadge priority={story.priority} />
                  {story.points != null && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', minWidth: '3rem', textAlign: 'right' }}>
                      {story.points} pts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
