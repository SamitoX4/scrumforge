import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { AUTOMATION_SUGGESTIONS } from '@/graphql/ai/ai.queries';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { UpgradePrompt } from '@/components/molecules/UpgradePrompt/UpgradePrompt';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

/**
 * Sugerencia de automatización generada por IA.
 * El backend analiza el historial del proyecto y propone reglas tipo "si X entonces Y".
 */
interface AutomationSuggestion {
  trigger: string;
  action: string;
  description: string;
}

/**
 * Iconos emoji indexados por tipo de trigger para dar contexto visual rápido.
 * DEFAULT se usa cuando el trigger no está en el mapa (p.ej. triggers personalizados).
 */
const TRIGGER_ICONS: Record<string, string> = {
  STATUS_CHANGE: '🔄',
  SPRINT_START: '🚀',
  SPRINT_END: '🏁',
  STORY_ASSIGNED: '👤',
  STORY_BLOCKED: '🚧',
  POINTS_THRESHOLD: '📊',
  DEADLINE_APPROACHING: '📅',
  DEFAULT: '⚡',
};

/**
 * Página de Automatización con IA.
 *
 * Muestra sugerencias de reglas de automatización generadas por el servidor a partir
 * del contexto del proyecto actual. Cada regla puede activarse/desactivarse de forma
 * independiente con un toggle. Las reglas activas se listan en una sección separada.
 *
 * Acceso: solo usuarios con plan que incluya la feature 'ai'. Si no tienen acceso,
 * se muestra un UpgradePrompt en lugar del contenido.
 *
 * Nota: el estado de los toggles es puramente local (no se persiste en el servidor),
 * ya que la implementación completa de ejecución de reglas es responsabilidad del backend.
 */
export default function AutomationPage() {
  const { t } = useTranslation();
  const { canUse } = usePlanFeatures();
  const { projectId } = useCurrentProject();
  const { data, loading, error } = useQuery<any>(AUTOMATION_SUGGESTIONS, {
    variables: { projectId },
    skip: !projectId,
  });

  const suggestions: AutomationSuggestion[] = data?.automationSuggestions ?? [];

  /**
   * Estado de activación de cada regla, indexado por posición en el array.
   * Se usa índice en lugar de un identificador porque las sugerencias de IA
   * no tienen IDs propios; son generadas dinámicamente.
   */
  const [enabled, setEnabled] = useState<Record<number, boolean>>({});

  /** Alterna el estado activo/inactivo de una regla por su índice. */
  function toggle(idx: number) {
    setEnabled((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  /** Lista de reglas actualmente activadas, usada para la sección de resumen. */
  const activeRules = suggestions.filter((_, idx) => enabled[idx]);

  // Guardia de plan: si el workspace no tiene acceso a IA, mostrar upgrade prompt
  if (!canUse('ai')) {
    return (
      <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
        <UpgradePrompt feature="AI Automation Rules" plan="business" />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Encabezado de la página */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', margin: 0, marginBottom: '6px' }}>
          ⚡ {t('automation.title')}
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.9375rem', margin: 0 }}>
          {t('automation.subtitle')}
        </p>
      </div>

      {/* Sección de reglas sugeridas por IA */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💡</span> {t('automation.suggestedRules')}
        </h2>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Spinner size="md" />
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem' }}>
            {t('automation.loadError')}: {error.message}
          </div>
        )}

        {!loading && !error && suggestions.length === 0 && (
          <div style={{ color: '#94A3B8', fontSize: '0.875rem', padding: '1.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #E2E8F0' }}>
            {t('automation.noSuggestions')}
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {suggestions.map((rule, idx) => {
              const isOn = !!enabled[idx];
              // Normalizar el trigger a mayúsculas sin espacios para buscar en el mapa de iconos
              const triggerKey = rule.trigger?.toUpperCase().replace(/\s+/g, '_');
              const icon = TRIGGER_ICONS[triggerKey] ?? TRIGGER_ICONS.DEFAULT;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 16px',
                    background: '#FFFFFF',
                    // Borde y sombra cambian visualmente cuando la regla está activa
                    border: `1px solid ${isOn ? '#C7D2FE' : '#E2E8F0'}`,
                    borderRadius: '10px',
                    boxShadow: isOn ? '0 0 0 3px rgba(99,102,241,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Trigger → Acción como píldoras de color para lectura rápida */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: '#6366F1',
                          background: '#EEF2FF',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {rule.trigger}
                      </span>
                      <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>→</span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: '#0EA5E9',
                          background: '#F0F9FF',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {rule.action}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
                      {rule.description}
                    </p>
                  </div>

                  {/*
                    Toggle personalizado implementado con un <button role="switch">.
                    El círculo blanco se desplaza con CSS transition para animar el cambio.
                    Se usa role="switch" + aria-checked para accesibilidad.
                  */}
                  <button
                    role="switch"
                    aria-checked={isOn}
                    onClick={() => toggle(idx)}
                    style={{
                      flexShrink: 0,
                      width: '40px',
                      height: '22px',
                      borderRadius: '11px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isOn ? '#6366F1' : '#CBD5E1',
                      position: 'relative',
                      transition: 'background 0.2s',
                      padding: 0,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '3px',
                        // Desplazar el círculo a la derecha cuando está activo
                        left: isOn ? '21px' : '3px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: '#FFFFFF',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 0.2s',
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Resumen de reglas activas — solo se muestra si hay al menos una activa */}
      {activeRules.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span> {t('automation.activeRules', { count: activeRules.length })}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeRules.map((rule, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  color: '#166534',
                }}
              >
                <span style={{ fontWeight: 700 }}>{rule.trigger}</span>
                <span style={{ color: '#4ADE80' }}>→</span>
                <span>{rule.action}</span>
                <span style={{ color: '#6B7280', marginLeft: 'auto', fontSize: '0.8125rem' }}>
                  {rule.description}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
