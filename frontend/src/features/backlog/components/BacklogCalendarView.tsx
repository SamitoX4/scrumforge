import { useState } from 'react';
import type { UserStory } from '@/types/api.types';

/**
 * Información mínima de un sprint necesaria para marcar su fecha de fin en el calendario.
 */
interface SprintInfo {
  id: string;
  name: string;
  /** Fecha ISO de fin del sprint; se usa para posicionar el marcador en el calendario. */
  endDate: string;
}

/**
 * Props del componente BacklogCalendarView.
 */
interface BacklogCalendarViewProps {
  /** Historias de usuario a mostrar en el calendario. */
  stories: UserStory[];
  /** Sprints cuyas fechas de fin se marcarán en el calendario. Opcional. */
  sprints?: SprintInfo[];
}

/** Abreviaturas de días en orden lunes-domingo (semana europea). */
const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Nombres completos de los meses para el encabezado de navegación. */
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Compara dos fechas ignorando la hora, comprobando solo año, mes y día.
 */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/**
 * Devuelve todos los objetos Date del mes especificado.
 * Itera desde el día 1 hasta que el mes cambia.
 */
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

/**
 * Construye la cuadrícula del calendario incluyendo celdas vacías para alinear
 * el primer día con su columna correcta (lunes = columna 0).
 *
 * JavaScript trata el domingo como día 0; la fórmula `(firstDay + 6) % 7`
 * convierte ese sistema al formato lunes-primero estándar en Europa.
 *
 * @returns Array de 35 o 42 elementos (semanas completas × 7 días),
 *          donde `null` representa una celda fuera del mes.
 */
function buildCalendarGrid(year: number, month: number): Array<Date | null> {
  const days = getDaysInMonth(year, month);
  const firstDay = days[0].getDay(); // 0 = domingo en JS
  // Convertir a lunes-primero: domingo (0) → 6, lunes (1) → 0, etc.
  const offset = (firstDay + 6) % 7;
  const grid: Array<Date | null> = Array(offset).fill(null);
  for (const d of days) grid.push(d);
  // Rellenar la última semana para que el grid siempre sea múltiplo de 7
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

/**
 * BacklogCalendarView
 *
 * Vista del backlog en forma de calendario mensual.
 * Las historias se ubican en el día de fin de su sprint asociado
 * (usando `story.sprint.endDate` como referencia).
 *
 * Características:
 * - Navegación mes a mes con botones ‹ / ›.
 * - El día actual se resalta con un círculo de color primario.
 * - Marcadores de fin de sprint en azul.
 * - Puntos de color por prioridad para cada historia (máximo 3 visibles por día).
 * - Leyenda de prioridades y fin de sprint al pie del calendario.
 *
 * @param stories - Historias a posicionar en el calendario.
 * @param sprints - Sprints con fechas de fin a marcar en el calendario.
 */
export function BacklogCalendarView({ stories, sprints = [] }: BacklogCalendarViewProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  /** Retrocede un mes, ajustando el año si se pasa de enero. */
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  /** Avanza un mes, ajustando el año si se pasa de diciembre. */
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const grid = buildCalendarGrid(viewYear, viewMonth);

  // Indexar sprints por su fecha de fin para O(1) lookup en el render de cada celda
  const sprintByDate = new Map<string, SprintInfo>();
  for (const s of sprints) {
    if (s.endDate) {
      const d = new Date(s.endDate);
      // Clave compuesta año-mes-día para evitar colisiones entre zonas horarias
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      sprintByDate.set(key, s);
    }
  }

  // Indexar historias por fecha de fin del sprint al que pertenecen
  // Se usa el sprint de la historia porque no todas tienen dueDate propio
  const storiesByDate = new Map<string, UserStory[]>();
  for (const story of stories) {
    let dateObj: Date | null = null;

    // Si la historia está en un sprint, usar la fecha de fin de ese sprint
    if (story.sprint?.endDate) {
      dateObj = new Date(story.sprint.endDate);
    }

    if (dateObj) {
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
      if (!storiesByDate.has(key)) storiesByDate.set(key, []);
      storiesByDate.get(key)!.push(story);
    }
  }

  /** Mapa de colores de prioridad para los puntos indicadores. */
  const PRIORITY_COLORS: Record<string, string> = {
    CRITICAL: '#EF4444',
    HIGH: '#F97316',
    MEDIUM: '#3B82F6',
    LOW: '#10B981',
  };

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Encabezado de navegación con mes/año y botones ‹ / › */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1rem',
        padding: '0.5rem 0',
      }}>
        <button
          onClick={prevMonth}
          style={{
            background: 'none',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '6px',
            padding: '0.25rem 0.625rem',
            cursor: 'pointer',
            fontSize: '1rem',
            color: 'var(--color-text-secondary, #64748b)',
          }}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <span style={{
          fontSize: '1rem',
          fontWeight: 600,
          minWidth: '160px',
          textAlign: 'center',
          color: 'var(--color-text, #1e293b)',
        }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          style={{
            background: 'none',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '6px',
            padding: '0.25rem 0.625rem',
            cursor: 'pointer',
            fontSize: '1rem',
            color: 'var(--color-text-secondary, #64748b)',
          }}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {/* Fila de cabeceras con los nombres de los días de la semana */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        background: 'var(--color-border, #e2e8f0)',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: '8px 8px 0 0',
        overflow: 'hidden',
      }}>
        {WEEK_DAYS.map((day) => (
          <div key={day} style={{
            background: 'var(--color-surface-raised, #f8fafc)',
            padding: '0.5rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-text-secondary, #64748b)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Cuadrícula principal del calendario */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        background: 'var(--color-border, #e2e8f0)',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        overflow: 'hidden',
      }}>
        {grid.map((day, idx) => {
          // Celda vacía fuera del mes (padding de inicio o fin)
          if (!day) {
            return (
              <div key={`empty-${idx}`} style={{
                background: 'var(--color-surface, #fff)',
                minHeight: '100px',
                opacity: 0.3,
              }} />
            );
          }

          const isToday = isSameDay(day, today);
          const isCurrentMonth = day.getMonth() === viewMonth;
          // Clave consistente con la usada al indexar sprints y historias
          const dateKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayStories = storiesByDate.get(dateKey) ?? [];
          const sprintEnd = sprintByDate.get(dateKey);

          return (
            <div
              key={dateKey}
              style={{
                // El día actual tiene fondo azul claro para destacarlo visualmente
                background: isToday
                  ? 'var(--color-primary-subtle, #eff6ff)'
                  : 'var(--color-surface, #fff)',
                minHeight: '100px',
                padding: '6px',
                // Los días fuera del mes visible se muestran semitransparentes
                opacity: isCurrentMonth ? 1 : 0.5,
              }}
            >
              {/* Número del día — círculo relleno si es hoy */}
              <div style={{
                fontSize: '0.75rem',
                fontWeight: isToday ? 700 : 400,
                color: isToday
                  ? 'var(--color-primary, #3b82f6)'
                  : 'var(--color-text, #1e293b)',
                marginBottom: '4px',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: isToday ? 'var(--color-primary, #3b82f6)' : 'transparent',
              }}
              >
                <span style={{ color: isToday ? '#fff' : 'inherit' }}>{day.getDate()}</span>
              </div>

              {/* Marcador de fin de sprint — chip azul con nombre truncado */}
              {sprintEnd && (
                <div style={{
                  background: '#3B82F6',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  padding: '1px 4px',
                  borderRadius: '3px',
                  marginBottom: '3px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
                  title={sprintEnd.name}
                >
                  {sprintEnd.name.length > 12 ? sprintEnd.name.slice(0, 12) + '…' : sprintEnd.name}
                </div>
              )}

              {/* Puntos de historias — máximo 3 para no desbordar la celda */}
              {dayStories.slice(0, 3).map((story) => (
                <div
                  key={story.id}
                  title={story.title}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '2px',
                    cursor: 'default',
                  }}
                >
                  {/* Punto coloreado según la prioridad de la historia */}
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: PRIORITY_COLORS[story.priority] ?? '#94A3B8',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: '0.65rem',
                    color: 'var(--color-text, #1e293b)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 'calc(100% - 11px)',
                  }}>
                    {story.title.length > 20 ? story.title.slice(0, 20) + '…' : story.title}
                  </span>
                </div>
              ))}

              {/* Indicador de desbordamiento cuando hay más de 3 historias en el día */}
              {dayStories.length > 3 && (
                <div style={{
                  fontSize: '0.65rem',
                  color: 'var(--color-text-secondary, #64748b)',
                  marginTop: '2px',
                }}>
                  +{dayStories.length - 3} más
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda de prioridades y marcador de fin de sprint */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginTop: '0.75rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)', fontWeight: 500 }}>Prioridad:</span>
        {Object.entries(PRIORITY_COLORS).map(([p, c]) => (
          <span key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, display: 'inline-block' }} />
            {p === 'CRITICAL' ? 'Crítica' : p === 'HIGH' ? 'Alta' : p === 'MEDIUM' ? 'Media' : 'Baja'}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)' }}>
          <span style={{ width: '30px', height: '10px', background: '#3B82F6', borderRadius: '3px', display: 'inline-block' }} />
          Fin de sprint
        </span>
      </div>
    </div>
  );
}
