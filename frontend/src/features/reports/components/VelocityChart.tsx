import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

/**
 * @interface VelocityData
 * @description Datos de velocidad de un sprint individual para la gráfica comparativa.
 * Permite comparar lo que se planeó contra lo que realmente se completó.
 */
interface VelocityData {
  /** ID único del sprint (usado como key interna, no visible en la gráfica). */
  sprintId: string;
  /** Nombre del sprint mostrado en el eje X de la gráfica. */
  sprintName: string;
  /** Puntos de historia completados al cierre del sprint (barra azul). */
  completedPoints: number;
  /** Puntos de historia planificados al inicio del sprint (barra gris de referencia). */
  plannedPoints: number;
}

/**
 * @interface VelocityChartProps
 * @description Props del componente VelocityChart.
 */
interface VelocityChartProps {
  /** Lista de sprints con sus datos de velocidad. Si está vacía se muestra un mensaje. */
  data: VelocityData[];
}

/**
 * @interface TooltipPayload
 * @description Estructura de cada entrada en el payload del tooltip de Recharts.
 * Recharts pasa esta forma de dato a los componentes personalizados de tooltip.
 */
interface TooltipPayload {
  /** Nombre de la serie (corresponde al prop `name` de cada `<Bar>`). */
  name: string;
  /** Valor numérico del punto de datos en esa serie. */
  value: number;
  /** Color de la serie, usado para mantener coherencia visual en el tooltip. */
  color: string;
}

/**
 * @component CustomTooltip
 * @description Tooltip personalizado para la gráfica de velocidad.
 *
 * Extiende el tooltip por defecto de Recharts añadiendo el porcentaje de cumplimiento
 * (completed / planned * 100), que es la métrica más valiosa para el Scrum Master.
 * El color del porcentaje cambia según umbrales:
 * - ≥ 100%: verde (objetivo superado)
 * - ≥ 80%:  amarillo (cumplimiento aceptable)
 * - < 80%:  rojo (sprint en riesgo o fallido)
 *
 * Las etiquetas se reciben como props en lugar de hardcodearlas para que el componente
 * respete el idioma activo a través del sistema i18n del padre.
 *
 * @param props - Props estándar de Recharts más las etiquetas localizadas.
 * @returns {JSX.Element | null} Panel del tooltip o null si no hay datos activos.
 */
function CustomTooltip({ active, payload, label, plannedLabel, completedLabel, fulfillmentLabel }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  /** Etiqueta localizada para los puntos planificados. */
  plannedLabel: string;
  /** Etiqueta localizada para los puntos completados. */
  completedLabel: string;
  /** Etiqueta localizada para el porcentaje de cumplimiento. */
  fulfillmentLabel: string;
}) {
  // Recharts pasa active=false cuando el cursor no está sobre ninguna barra
  if (!active || !payload?.length) return null;

  // Se busca cada serie por nombre en lugar de por índice para ser resiliente
  // ante reordenamientos de las barras en el JSX del componente padre.
  const planned = payload.find((p) => p.name === plannedLabel)?.value ?? 0;
  const completed = payload.find((p) => p.name === completedLabel)?.value ?? 0;

  // Cumplimiento como porcentaje; se protege contra división por cero
  const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: '#1E293B' }}>{label}</p>
      <p style={{ color: '#94A3B8' }}>{plannedLabel}: <strong style={{ color: '#1E293B' }}>{planned} pts</strong></p>
      <p style={{ color: '#94A3B8' }}>{completedLabel}: <strong style={{ color: '#3B82F6' }}>{completed} pts</strong></p>
      {/* Separador visual y porcentaje con codificación de color por umbral */}
      <p style={{ color: '#94A3B8', marginTop: 4, borderTop: '1px solid #F1F5F9', paddingTop: 4 }}>
        {fulfillmentLabel}: <strong style={{ color: pct >= 100 ? '#10B981' : pct >= 80 ? '#F59E0B' : '#EF4444' }}>{pct}%</strong>
      </p>
    </div>
  );
}

/**
 * @component VelocityChart
 * @description Gráfica de barras agrupadas que compara la velocidad planificada vs. completada
 * a lo largo de múltiples sprints.
 *
 * Cada sprint se representa como un par de barras:
 * - **Gris** (plannedPoints): puntos comprometidos al inicio del sprint.
 * - **Azul** (completedPoints): puntos realmente completados y aceptados al cierre.
 *
 * Las etiquetas del tooltip y la leyenda se obtienen de i18n para soportar multiidioma.
 * El tooltip personalizado (`CustomTooltip`) calcula y muestra el porcentaje de cumplimiento
 * con codificación semáforo para facilitar la interpretación rápida.
 *
 * @param {VelocityChartProps} props
 * @returns {JSX.Element} Gráfica de velocidad o mensaje de estado vacío.
 */
export function VelocityChart({ data }: VelocityChartProps) {
  const { t } = useTranslation();

  // Las etiquetas se calculan una sola vez y se pasan al tooltip personalizado
  // para evitar llamadas repetidas a t() dentro de cada render del tooltip.
  const plannedLabel = t('reports.planned');
  const completedLabel = t('reports.completed');
  const fulfillmentLabel = t('reports.fulfillment');

  // Renderizado temprano si no hay sprints cerrados aún
  if (data.length === 0) {
    return (
      <p style={{ color: '#94A3B8', textAlign: 'center', padding: '2rem 0' }}>
        {t('reports.velocityEmptyFull')}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="sprintName" tick={{ fontSize: 11, fill: '#94A3B8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
        {/* Se inyecta el tooltip personalizado pasando las etiquetas localizadas como props */}
        <Tooltip content={
          <CustomTooltip
            plannedLabel={plannedLabel}
            completedLabel={completedLabel}
            fulfillmentLabel={fulfillmentLabel}
          />
        } />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* Barra gris para planificado: sirve como referencia visual de fondo */}
        <Bar dataKey="plannedPoints" name={plannedLabel} fill="#E2E8F0" radius={[4, 4, 0, 0]} />
        {/* Barra azul para completado: resaltada sobre la barra de referencia */}
        <Bar dataKey="completedPoints" name={completedLabel} fill="#3B82F6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
