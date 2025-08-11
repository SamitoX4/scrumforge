import { useQuery } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { SPRINT_RISKS } from '@/graphql/ai/ai.queries';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

/**
 * Representa un riesgo identificado por IA para el sprint activo.
 */
interface SprintRisk {
  /** Categoría del riesgo (ej. SCOPE, VELOCITY, BLOCKERS). */
  type: string;
  /** Descripción legible del riesgo generada por el modelo de IA. */
  message: string;
  /** Nivel de gravedad del riesgo. */
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Props del componente SprintRisksPanel.
 */
interface SprintRisksPanelProps {
  /** ID del sprint del que se obtendrán los riesgos. */
  sprintId: string;
}

/**
 * Mapa de colores de fondo y texto para cada nivel de severidad.
 * Sigue la convención semántica: rojo → alto, amarillo → medio, verde → bajo.
 */
const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  HIGH: { bg: '#FEE2E2', color: '#DC2626' },
  MEDIUM: { bg: '#FEF3C7', color: '#D97706' },
  LOW: { bg: '#D1FAE5', color: '#059669' },
};

/**
 * Mapa de emojis/iconos para cada tipo de riesgo.
 * DEFAULT se usa como fallback para tipos no reconocidos.
 */
const TYPE_ICONS: Record<string, string> = {
  SCOPE: '📐',
  VELOCITY: '⚡',
  BLOCKERS: '🚧',
  TEAM: '👥',
  DEADLINE: '📅',
  CAPACITY: '🔋',
  DEFAULT: '⚠️',
};

/**
 * SprintRisksPanel
 *
 * Panel generado por IA que analiza el sprint activo e identifica riesgos
 * potenciales clasificados por tipo y severidad.
 *
 * Estados posibles del componente:
 * - Sin sprintId: mensaje informativo de que no hay sprint activo.
 * - Cargando: spinner centrado.
 * - Error en la consulta: mensaje de error en rojo.
 * - Sin riesgos identificados: mensaje positivo en verde.
 * - Con riesgos: tarjetas ordenadas por el servidor, con borde izquierdo de color
 *   según severidad, icono del tipo y texto del mensaje.
 *
 * @param sprintId - ID del sprint a analizar. Si está vacío, no se ejecuta la query.
 */
export function SprintRisksPanel({ sprintId }: SprintRisksPanelProps) {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<any>(SPRINT_RISKS, {
    variables: { sprintId },
    // Evitar la llamada al backend si no hay sprint seleccionado
    skip: !sprintId,
  });

  // Las etiquetas de severidad se construyen dentro del componente para
  // que reaccionen a cambios de idioma en tiempo real
  const SEVERITY_LABELS: Record<string, string> = {
    HIGH: t('reports.riskHigh'),
    MEDIUM: t('reports.riskMedium'),
    LOW: t('reports.riskLow'),
  };

  if (!sprintId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
        {t('reports.noActiveSprint')}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#EF4444' }}>
        {t('reports.risksError')}: {error.message}
      </div>
    );
  }

  // Extraer la lista de riesgos; si la respuesta está vacía se usa array vacío
  const risks: SprintRisk[] = data?.sprintRisks ?? [];

  if (risks.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#10B981', fontSize: '1.1rem' }}>
        {t('reports.noRisks')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '1rem 0' }}>
      {risks.map((risk, idx) => {
        // Fallback a MEDIUM si llega un nivel de severidad desconocido
        const severity = SEVERITY_COLORS[risk.severity] ?? SEVERITY_COLORS.MEDIUM;
        // Fallback al valor raw si no hay traducción para esa severidad
        const severityLabel = SEVERITY_LABELS[risk.severity] ?? risk.severity;
        // Fallback al icono por defecto si el tipo no está mapeado
        const icon = TYPE_ICONS[risk.type] ?? TYPE_ICONS.DEFAULT;
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderLeft: `4px solid ${severity.color}`,
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <span style={{ fontSize: '1.25rem', flexShrink: 0, lineHeight: 1 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: severity.bg,
                    color: severity.color,
                  }}
                >
                  {severityLabel}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: '#94A3B8',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {risk.type}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
                {risk.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
