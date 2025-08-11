import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

/**
 * Un punto de datos diario del diagrama de flujo acumulativo.
 * Cada campo numérico representa la cantidad de historias en ese estado
 * en la fecha indicada.
 */
interface CumulativeFlowPoint {
  /** Fecha en formato ISO (ej. "2026-03-15"). */
  date: string;
  /** Historias en estado TODO. */
  todo: number;
  /** Historias en estado IN_PROGRESS. */
  inProgress: number;
  /** Historias en estado IN_REVIEW. */
  inReview: number;
  /** Historias en estado DONE. */
  done: number;
  /** Historias en estado BLOCKED. */
  blocked: number;
}

/**
 * Props del componente CumulativeFlowChart.
 */
interface CumulativeFlowChartProps {
  /** Serie temporal con los conteos por estado para cada día del sprint. */
  data: CumulativeFlowPoint[];
}

/**
 * Colores asignados a cada estado para las áreas apiladas del gráfico.
 * Siguen la misma paleta que los badges de estado en el resto de la aplicación.
 */
const STATUS_COLORS = {
  todo: '#6B7280',
  inProgress: '#3B82F6',
  inReview: '#8B5CF6',
  done: '#10B981',
  blocked: '#EF4444',
};

/**
 * CumulativeFlowChart
 *
 * Diagrama de flujo acumulativo (CFD) del sprint. Muestra cómo evolucionan
 * los conteos de historias por estado a lo largo del tiempo mediante áreas
 * apiladas (stackId="1").
 *
 * Un CFD saludable muestra un crecimiento constante del área "done" y bandas
 * estrechas y estables en los estados intermedios. Bandas que crecen o se
 * ensanchan indican cuellos de botella.
 *
 * Las etiquetas de los estados se resuelven a través de i18n para soportar
 * múltiples idiomas. Si no hay datos, se muestra un mensaje de estado vacío.
 *
 * @param data - Array de puntos diarios con conteos por estado.
 */
export function CumulativeFlowChart({ data }: CumulativeFlowChartProps) {
  const { t } = useTranslation();

  // Las etiquetas se definen dentro del render para reaccionar a cambios de idioma
  const STATUS_LABELS: Record<string, string> = {
    todo: t('status.TODO'),
    inProgress: t('status.IN_PROGRESS'),
    inReview: t('status.IN_REVIEW'),
    done: t('status.DONE'),
    blocked: t('status.BLOCKED'),
  };

  // Estado vacío: el sprint aún no tiene snapshots diarios registrados
  if (data.length === 0) {
    return (
      <p style={{ color: '#94A3B8', textAlign: 'center', padding: '2rem 0' }}>
        {t('reports.noFlowData')}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          {/* Mostrar solo MM-DD para mayor legibilidad, omitiendo el año */}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* Generar un componente Area por cada estado usando el orden de STATUS_COLORS.
            Todos comparten el mismo stackId para que las áreas se apilen correctamente. */}
        {(Object.keys(STATUS_COLORS) as Array<keyof typeof STATUS_COLORS>).map((key) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            name={STATUS_LABELS[key]}
            stackId="1"
            stroke={STATUS_COLORS[key]}
            fill={STATUS_COLORS[key]}
            fillOpacity={0.6}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
