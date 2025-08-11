import { useLazyQuery } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { DAILY_SUMMARY } from '@/graphql/ai/ai.queries';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

/**
 * Props del componente DailySummaryPanel.
 */
interface DailySummaryPanelProps {
  /** ID del proyecto para el que se generará el resumen diario. */
  projectId: string;
}

/**
 * DailySummaryPanel
 *
 * Panel de resumen diario generado por IA (Anthropic / Claude).
 * El resumen no se carga automáticamente; el usuario debe pulsar el botón
 * "Generar resumen" para disparar la llamada al backend.
 *
 * Comportamiento de la query:
 * - Se usa `useLazyQuery` con `fetchPolicy: 'network-only'` para garantizar
 *   que cada pulsación del botón genera un nuevo resumen fresco (no cacheado).
 * - `called` permite distinguir entre "aún no se ha pulsado" y "se pulsó pero
 *   no hay datos" para mostrar el mensaje de vacío apropiado.
 *
 * Renderizado del resultado:
 * - Si el texto tiene más de una línea no vacía, se renderiza como lista `<ul>`
 *   eliminando los marcadores de lista del texto (-, •, *) para evitar duplicados.
 * - Si el texto es de una sola línea (o el modelo devolvió un párrafo), se usa
 *   `<pre>` con `white-space: pre-wrap` para conservar el formato.
 *
 * @param projectId - ID del proyecto activo. El botón queda deshabilitado si está vacío.
 */
export function DailySummaryPanel({ projectId }: DailySummaryPanelProps) {
  const { t } = useTranslation();

  // useLazyQuery devuelve una función de disparo; la query NO se ejecuta al montar
  const [fetchSummary, { data, loading, error, called }] = useLazyQuery<any>(DAILY_SUMMARY, {
    fetchPolicy: 'network-only',
  });

  // Extraer el texto del resumen (null si aún no se ha generado)
  const summary: string | null = data?.dailySummary ?? null;

  // Dividir el texto en líneas no vacías para decidir entre lista o párrafo
  const lines = summary
    ? summary
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return (
    <div style={{ padding: '1rem 0' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          onClick={() => fetchSummary({ variables: { projectId } })}
          disabled={loading || !projectId}
          style={{
            padding: '10px 20px',
            background: loading ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: loading ? '#94A3B8' : '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: loading || !projectId ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? (
            <>
              <Spinner size="sm" />
              {t('reports.generating')}
            </>
          ) : (
            t('reports.generateSummary')
          )}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            color: '#DC2626',
            fontSize: '0.875rem',
          }}
        >
          {t('reports.summaryError')}: {error.message}
        </div>
      )}

      {/* Mensaje de vacío: la query se ejecutó (called=true) pero no devolvió texto */}
      {!loading && called && !error && !summary && (
        <div style={{ color: '#94A3B8', fontSize: '0.875rem', padding: '1rem 0' }}>
          {t('reports.noSummaryData')}
        </div>
      )}

      {summary && !loading && (
        <div
          style={{
            background: '#F8FAFF',
            border: '1px solid #E0E7FF',
            borderRadius: '10px',
            padding: '1.25rem 1.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #E0E7FF',
            }}
          >
            <span style={{ fontSize: '1rem' }}>🤖</span>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#6366F1',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {t('reports.aiGenerated')}
            </span>
          </div>

          {lines.length > 1 ? (
            // Múltiples líneas: renderizar como lista eliminando prefijos de viñeta
            <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'disc' }}>
              {lines.map((line, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: '0.875rem',
                    color: '#334155',
                    lineHeight: 1.6,
                    marginBottom: '4px',
                  }}
                >
                  {/* Eliminar prefijos de viñeta del modelo (-, •, *) */}
                  {line.replace(/^[-•*]\s*/, '')}
                </li>
              ))}
            </ul>
          ) : (
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                color: '#334155',
                lineHeight: 1.6,
              }}
            >
              {summary}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
