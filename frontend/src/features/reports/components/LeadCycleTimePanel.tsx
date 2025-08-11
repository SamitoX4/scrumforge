import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Datos de Lead/Cycle Time para una única historia de usuario.
 *
 * - `leadTimeDays`: días desde la creación hasta la finalización (puede ser nulo si
 *   la historia no tiene fecha de creación registrada).
 * - `cycleTimeDays`: días desde que se comenzó a trabajar hasta la finalización
 *   (puede ser nulo si la historia no se ha movido a IN_PROGRESS aún).
 * - `completedAt`: fecha ISO en que la historia pasó a estado DONE, o null.
 */
interface LeadCycleStory {
  storyId: string;
  title: string;
  leadTimeDays: number | null;
  cycleTimeDays: number | null;
  completedAt: string | null;
}

/**
 * Reporte agregado de Lead y Cycle Time para un proyecto.
 * Incluye los promedios globales y el detalle por historia.
 */
interface LeadCycleTimeReport {
  /** Promedio de Lead Time en días sobre todas las historias completadas. */
  avgLeadTimeDays: number;
  /** Promedio de Cycle Time en días sobre todas las historias completadas. */
  avgCycleTimeDays: number;
  /** Lista de historias completadas con sus métricas individuales. */
  stories: LeadCycleStory[];
}

/**
 * Props del componente LeadCycleTimePanel.
 */
interface LeadCycleTimePanelProps {
  /** Datos del reporte de Lead/Cycle Time obtenidos desde el servidor. */
  data: LeadCycleTimeReport;
}

/**
 * LeadCycleTimePanel
 *
 * Panel de reportes que muestra las métricas de Lead Time y Cycle Time del proyecto.
 *
 * - **KPIs superiores**: dos tarjetas con los promedios globales de Lead Time y Cycle Time.
 * - **Tabla de historias**: lista de historias completadas ordenadas por fecha de
 *   finalización (más reciente primero), con columnas de Lead Time, Cycle Time y fecha.
 *
 * Si no hay historias completadas, muestra un mensaje de estado vacío.
 * Los valores nulos (historias sin fecha de inicio o creación) se muestran como "—".
 * La fecha de finalización se formatea según el idioma activo del usuario.
 *
 * @param data - Reporte con promedios y detalle por historia.
 */
export function LeadCycleTimePanel({ data }: LeadCycleTimePanelProps) {
  const { t, i18n } = useTranslation();

  // Ordenar historias de más reciente a más antigua para facilitar el seguimiento
  const sorted = [...data.stories].sort(
    (a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <p style={{ color: '#94A3B8', textAlign: 'center', padding: '2rem 0' }}>
        {t('reports.noCompletedStories')}
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={kpiCardStyle}>
          <span style={kpiLabelStyle}>{t('reports.leadTimeAvg')}</span>
          <span style={kpiValueStyle}>{data.avgLeadTimeDays.toFixed(1)} {t('reports.days')}</span>
        </div>
        <div style={kpiCardStyle}>
          <span style={kpiLabelStyle}>{t('reports.cycleTimeAvg')}</span>
          <span style={kpiValueStyle}>{data.avgCycleTimeDays.toFixed(1)} {t('reports.days')}</span>
        </div>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>{t('reports.colStory')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>{t('reports.colLeadTime')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>{t('reports.colCycleTime')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>{t('reports.colCompleted')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((story) => (
            <tr key={story.storyId} style={trStyle}>
              <td style={tdStyle}>{story.title}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{story.leadTimeDays != null ? `${story.leadTimeDays.toFixed(1)} d` : '—'}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{story.cycleTimeDays != null ? `${story.cycleTimeDays.toFixed(1)} d` : '—'}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                {story.completedAt ? new Date(story.completedAt).toLocaleDateString(i18n.language, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Estilo de cada tarjeta KPI (Lead Time promedio / Cycle Time promedio). */
const kpiCardStyle: CSSProperties = {
  flex: 1,
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  padding: '1rem 1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

/** Estilo de la etiqueta descriptiva dentro de cada tarjeta KPI. */
const kpiLabelStyle: CSSProperties = {
  fontSize: 12,
  color: '#64748B',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

/** Estilo del valor numérico prominente dentro de cada tarjeta KPI. */
const kpiValueStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: '#1E293B',
};

/** Estilo de la tabla de historias: ancho completo y sin bordes dobles. */
const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

/** Estilo de las celdas de cabecera de la tabla. */
const thStyle: CSSProperties = {
  padding: '8px 12px',
  borderBottom: '2px solid #E2E8F0',
  color: '#64748B',
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  textAlign: 'left',
};

/** Estilo de las celdas de datos de la tabla. */
const tdStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #F1F5F9',
  color: '#334155',
  textAlign: 'left',
};

/** Estilo de las filas de datos (actualmente sin estilos adicionales). */
const trStyle: CSSProperties = {};
