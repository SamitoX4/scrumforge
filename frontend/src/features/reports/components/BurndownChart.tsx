import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

/**
 * @interface BurndownPoint
 * @description Representa un punto de datos en la gráfica de burndown del sprint.
 * Cada punto corresponde a un día del sprint con los puntos reales restantes
 * y los puntos que idealmente deberían quedar según la velocidad lineal esperada.
 */
interface BurndownPoint {
  /** Fecha del punto en formato ISO (YYYY-MM-DD). */
  date: string;
  /** Puntos de historia que quedan pendientes al final de ese día (línea real). */
  remainingPoints: number;
  /** Puntos que deberían quedar según la quema ideal lineal (línea de referencia). */
  idealPoints: number;
}

/**
 * @interface BurndownChartProps
 * @description Props del componente BurndownChart.
 */
interface BurndownChartProps {
  /** Array de puntos diarios del sprint. Si está vacío se muestra un mensaje de estado. */
  data: BurndownPoint[];
}

/**
 * @component BurndownChart
 * @description Gráfica de líneas que muestra el progreso de quema de puntos de un sprint.
 *
 * Compara dos series temporales:
 * - **Puntos restantes** (azul, línea continua): progreso real del equipo día a día.
 * - **Línea ideal** (gris, línea discontinua): referencia de quema perfectamente lineal
 *   desde el total inicial hasta cero al final del sprint.
 *
 * La divergencia entre ambas líneas indica si el equipo va adelantado o retrasado
 * respecto al plan original, siendo el principal indicador visual de riesgo en el sprint.
 *
 * Si no hay datos (sprint sin puntos estimados o sin registro diario), renderiza
 * un mensaje localizado en lugar de una gráfica vacía.
 *
 * @param {BurndownChartProps} props
 * @returns {JSX.Element} Gráfica de burndown o mensaje de estado vacío.
 */
export function BurndownChart({ data }: BurndownChartProps) {
  const { t } = useTranslation();

  // Renderizado temprano: evita montar Recharts con un array vacío,
  // lo que produciría una gráfica en blanco sin información útil.
  if (data.length === 0) {
    return (
      <p style={{ color: '#94A3B8', textAlign: 'center', padding: '2rem 0' }}>
        {t('reports.burndownNoPoints')}
      </p>
    );
  }

  return (
    // ResponsiveContainer hace que la gráfica se adapte al ancho de su contenedor padre
    // en lugar de tener dimensiones fijas, lo que es esencial para layouts fluidos.
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          // Se recortan los primeros 5 caracteres (YYYY-) para mostrar solo MM-DD,
          // reduciendo el ruido visual en el eje X sin perder información relevante.
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* Línea de progreso real: trazo continuo para diferenciarla visualmente de la ideal */}
        <Line
          type="monotone"
          dataKey="remainingPoints"
          name={t('reports.remainingPoints')}
          stroke="#3B82F6"
          strokeWidth={2}
          dot={false}
        />
        {/* Línea ideal: trazo discontinuo (strokeDasharray) para indicar que es una referencia, no datos reales */}
        <Line
          type="monotone"
          dataKey="idealPoints"
          name={t('reports.ideal')}
          stroke="#E2E8F0"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
