import { useState } from 'react';
import { Button } from '@/components/atoms/Button/Button';

/**
 * Clave de localStorage que indica si el usuario ya completó o saltó el tour de onboarding.
 * Al guardarse como 'true', el componente se desmonta y no vuelve a mostrarse en sesiones futuras.
 */
const STORAGE_KEY = 'scrumforge_onboarding_done';

/**
 * Pasos del tour de bienvenida en orden de presentación.
 * Cada string incluye un emoji y una breve instrucción orientativa sobre una funcionalidad clave.
 * El orden sigue el flujo natural de trabajo en Scrum: backlog → sprint → tablero → reportes.
 */
const STEPS = [
  '👋 Bienvenido a ScrumForge — Tu backlog está aquí',
  '📋 Crea tu primera historia con el botón + Añadir historia',
  '🚀 Planifica tu sprint arrastrando historias a Planning',
  '🗂 Ejecuta el sprint desde el Tablero Kanban',
  '📊 Revisa tu progreso en Reportes',
];

/**
 * @component OnboardingTooltips
 * @description Tour de bienvenida paso a paso para nuevos usuarios de ScrumForge.
 *
 * Se muestra como un panel flotante fijo en la esquina inferior derecha de la pantalla
 * (posición que evita tapar el contenido principal) para guiar al usuario a través de
 * las funciones fundamentales de la plataforma sin bloquear la UI.
 *
 * El tour es persistente entre recargas: una vez completado o saltado, se guarda
 * en localStorage y el componente deja de renderizarse para esa sesión y las siguientes.
 *
 * Controles disponibles:
 * - **Botón ×** (esquina superior): salta y finaliza el tour inmediatamente.
 * - **"Saltar tour"** (enlace inferior izquierdo): misma acción que ×, alternativa accesible.
 * - **"Siguiente"**: avanza al paso siguiente.
 * - **"Finalizar"** (en el último paso): completa el tour y cierra el panel.
 *
 * Los indicadores de progreso (dots) permiten al usuario saber en qué paso está
 * y cuántos quedan, sin necesidad de texto adicional.
 *
 * @returns {JSX.Element | null} Panel del tour o null si ya fue completado/saltado.
 */
export function OnboardingTooltips() {
  // Inicialización lazy: se lee localStorage solo en el primer render para determinar
  // si el tour ya fue completado, evitando parpadeos con condición post-mount.
  const [done, setDone] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  );
  const [step, setStep] = useState(0);

  // Desmonte temprano: no renderizar nada si el tour ya se completó o saltó
  if (done) return null;

  /**
   * Marca el tour como finalizado, persiste el estado en localStorage
   * y actualiza el estado local para desmontar el componente.
   */
  function finish() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDone(true);
  }

  // Determina si se está en el último paso para cambiar el texto del botón de avance
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Tour de bienvenida"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,          // Por encima de cualquier otro elemento de la UI
        width: '320px',
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #E2E8F0)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Cabecera: contador de paso y botón de cierre rápido */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary, #64748B)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Paso {step + 1} de {STEPS.length}
        </span>
        <button
          onClick={finish}
          aria-label="Saltar tour"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary, #64748B)',
            fontSize: '18px',
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </button>
      </div>

      {/* Contenido del paso actual */}
      <p
        style={{
          margin: 0,
          fontSize: '14px',
          color: 'var(--text-primary, #1E293B)',
          lineHeight: 1.5,
        }}
      >
        {STEPS[step]}
      </p>

      {/* Indicadores de progreso (dots): el activo se colorea con el color primario */}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
        {STEPS.map((_, i) => (
          <span
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              // El dot activo usa el color primario; los inactivos usan el color de borde
              background:
                i === step
                  ? '#6366F1'
                  : 'var(--border-color, #E2E8F0)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>

      {/* Pie del panel: acciones de navegación (saltar a la izquierda, avanzar a la derecha) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '4px',
        }}
      >
        <button
          onClick={finish}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--text-secondary, #64748B)',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Saltar tour
        </button>

        {/* En el último paso el botón llama a finish(); en el resto avanza al siguiente */}
        <Button
          size="sm"
          variant="primary"
          onClick={isLast ? finish : () => setStep((s) => s + 1)}
        >
          {isLast ? 'Finalizar' : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
}
