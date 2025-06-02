import { useEffect, useState, type CSSProperties } from 'react';
import { useQuery } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { HAS_ANTHROPIC_KEY } from '@/graphql/user/anthropic-key.queries';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useActiveSprint } from '@/hooks/useActiveSprint';
import {
  GET_BURNDOWN,
  GET_VELOCITY,
  BURNDOWN_UPDATED,
} from '@/graphql/reports/reports.queries';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { BurndownChart } from './BurndownChart';
import { VelocityChart } from './VelocityChart';
import { SprintSummaryCard } from './SprintSummaryCard';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { frontendExtensionRegistry } from '@/extensions/extension-registry';
import styles from './ReportsView.module.scss';

/**
 * Identificadores posibles de las pestañas de reportes.
 * Las pestañas 'cumulative', 'leadcycle', 'risks' y 'summary' solo aparecen
 * si el slot de extensión correspondiente está registrado.
 */
type TabId = 'burndown' | 'velocity' | 'cumulative' | 'leadcycle' | 'risks' | 'summary';

/**
 * ReportsView
 *
 * Vista principal de reportes del proyecto activo. Muestra una barra de pestañas
 * cuyo contenido varía según la pestaña activa:
 *
 * - **burndown**: Gráfico de burndown del sprint activo con actualización en tiempo
 *   real vía suscripción GraphQL (WebSocket).
 * - **velocity**: Gráfico de velocidad de los últimos 6 sprints.
 * - **cumulative**: Diagrama de flujo acumulativo (requiere extensión registrada).
 * - **leadcycle**: Métricas de Lead/Cycle Time (requiere extensión registrada).
 * - **risks**: Panel de riesgos del sprint (requiere extensión registrada).
 * - **summary**: Resumen diario generado por IA (requiere extensión registrada).
 *
 * Las pestañas opcionales se incluyen dinámicamente según los slots de extensión
 * disponibles en `frontendExtensionRegistry`, permitiendo un diseño plugin-like.
 */
export default function ReportsView() {
  const [activeTab, setActiveTab] = useState<TabId>('burndown');
  const { t } = useTranslation();

  // Comprobamos qué extensiones opcionales están registradas para construir
  // la lista de pestañas de forma dinámica
  const hasCumulative  = !!frontendExtensionRegistry.getSlot('reports-cumulative-flow');
  const hasLeadCycle   = !!frontendExtensionRegistry.getSlot('reports-lead-cycle-time');
  const hasRisks       = !!frontendExtensionRegistry.getSlot('reports-sprint-risks');
  const hasSummary     = !!frontendExtensionRegistry.getSlot('reports-daily-summary');

  /**
   * Lista de pestañas visible para el usuario.
   * Las dos primeras son siempre visibles; las demás se añaden condicionalmente
   * si el slot de extensión correspondiente está disponible.
   */
  const TABS: { id: TabId; label: string }[] = [
    { id: 'burndown', label: t('reports.burndown') },
    { id: 'velocity', label: t('reports.velocity') },
    ...(hasCumulative ? [{ id: 'cumulative' as TabId, label: t('reports.cumulativeFlow') }] : []),
    ...(hasLeadCycle  ? [{ id: 'leadcycle'  as TabId, label: t('reports.leadCycleTime') }] : []),
    ...(hasRisks      ? [{ id: 'risks'      as TabId, label: `⚠️ ${t('reports.sprintRisks')}` }] : []),
    ...(hasSummary    ? [{ id: 'summary'    as TabId, label: `📋 ${t('reports.dailySummary')}` }] : []),
  ];
  const { projectId } = useCurrentProject();
  const { sprint: activeSprint } = useActiveSprint(projectId);
  const sprintId = activeSprint?.id;

  // Consulta del burndown del sprint activo; se omite si no hay sprint
  const { data: burndownData, loading: burndownLoading, subscribeToMore } = useQuery<any>(GET_BURNDOWN, {
    variables: { sprintId },
    skip: !sprintId,
  });

  // Suscripción en tiempo real al burndown: actualiza la caché Apollo
  // cada vez que el backend emite un evento BURNDOWN_UPDATED
  useEffect(() => {
    if (!sprintId) return;
    const unsubscribe = subscribeToMore({
      document: BURNDOWN_UPDATED,
      variables: { sprintId },
      updateQuery: (_prev, { subscriptionData }) => {
        // Si el evento no trae datos válidos, conservamos el estado anterior
        if (!subscriptionData.data?.burndownUpdated) return _prev;
        return { burndownReport: subscriptionData.data.burndownUpdated };
      },
    });
    // Cancelar la suscripción al desmontar o cuando cambie el sprint
    return unsubscribe;
  }, [sprintId, subscribeToMore]);

  // Consulta de velocidad: obtiene los últimos 6 sprints del proyecto
  const { data: velocityData, loading: velocityLoading } = useQuery<any>(GET_VELOCITY, {
    variables: { projectId, lastSprints: 6 },
    skip: !projectId,
  });

  // Verifica si el usuario tiene configurada una API key de Anthropic;
  // si no hay respuesta aún (undefined), asume true para no bloquear la UI
  const { data: anthropicData } = useQuery<{ hasAnthropicApiKey: boolean }>(HAS_ANTHROPIC_KEY, {
    fetchPolicy: 'cache-and-network',
  });
  const hasAnthropicKey = anthropicData?.hasAnthropicApiKey ?? true;

  // Solo mostramos el spinner de la pestaña activa para no bloquear
  // la navegación entre pestañas que ya tienen datos cargados
  const isTabLoading =
    (activeTab === 'burndown' && burndownLoading) ||
    (activeTab === 'velocity' && velocityLoading);

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 className={styles.title} style={{ marginBottom: 0 }}>{t('reports.title')}</h1>
        <ExtensionSlot name="reports-export-btn" slotProps={{ projectId: projectId ?? '' }} />
      </div>

      {activeSprint && (
        <div className={styles.summaryRow}>
          <SprintSummaryCard sprint={activeSprint} />
        </div>
      )}

      <div style={tabBarStyle}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={activeTab === tab.id ? activeTabStyle : tabStyle}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {isTabLoading && (
          <div className={styles.loading}><Spinner size="lg" /></div>
        )}

        {!isTabLoading && activeTab === 'burndown' && (
          burndownData?.burndownReport ? (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{t('reports.burndown')} — {burndownData.burndownReport.sprint.name}</h2>
              <BurndownChart data={burndownData.burndownReport.points} />
            </section>
          ) : (
            <div className={styles.empty}>
              <p>{t('reports.burndownEmpty')}</p>
            </div>
          )
        )}

        {!isTabLoading && activeTab === 'velocity' && (
          velocityData?.velocityReport ? (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                {t('reports.teamVelocity')}
                <span className={styles.avg}>
                  {t('reports.avg', { value: velocityData.velocityReport.averageVelocity.toFixed(1) })}
                </span>
              </h2>
              <VelocityChart data={velocityData.velocityReport.sprints} />
            </section>
          ) : (
            <div className={styles.empty}>
              <p>{t('reports.velocityEmpty')}</p>
            </div>
          )
        )}

        {!isTabLoading && activeTab === 'cumulative' && (
          <section className={styles.card} style={{ gridColumn: '1 / -1' }}>
            <h2 className={styles.cardTitle}>{t('reports.cumulativeFlow')}</h2>
            <ExtensionSlot
              name="reports-cumulative-flow"
              slotProps={{ sprintId: sprintId ?? '' }}
            />
          </section>
        )}

        {!isTabLoading && activeTab === 'leadcycle' && (
          <section className={styles.card} style={{ gridColumn: '1 / -1' }}>
            <h2 className={styles.cardTitle}>{t('reports.leadCycleTime')}</h2>
            <ExtensionSlot
              name="reports-lead-cycle-time"
              slotProps={{ projectId: projectId ?? '' }}
            />
          </section>
        )}

        {activeTab === 'risks' && (
          <section className={styles.card} style={{ gridColumn: '1 / -1' }}>
            <h2 className={styles.cardTitle}>{t('reports.sprintRisks')}</h2>
            <ExtensionSlot
              name="reports-sprint-risks"
              slotProps={{ sprintId: activeSprint?.id ?? '', hasAnthropicKey }}
            />
          </section>
        )}

        {activeTab === 'summary' && (
          <section className={styles.card} style={{ gridColumn: '1 / -1' }}>
            <h2 className={styles.cardTitle}>{t('reports.aiSummary')}</h2>
            <ExtensionSlot
              name="reports-daily-summary"
              slotProps={{ projectId: projectId ?? '', hasAnthropicKey }}
            />
          </section>
        )}
      </div>
    </div>
  );
}

/** Estilo del contenedor de la barra de pestañas. */
const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  borderBottom: '2px solid #E2E8F0',
  marginBottom: '1.5rem',
};

/** Estilo base de cada botón de pestaña (inactiva). */
const tabStyle: CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  background: 'transparent',
  color: '#64748B',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: 14,
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  // El margen negativo inferior alinea el borde del botón con el borde del contenedor
  marginBottom: -2,
  transition: 'color 0.15s',
};

/**
 * Estilo de la pestaña activa: hereda todos los valores de tabStyle
 * y sobreescribe color y borde inferior para el indicador de selección.
 */
const activeTabStyle: CSSProperties = {
  ...tabStyle,
  color: '#3B82F6',
  borderBottomColor: '#3B82F6',
};

