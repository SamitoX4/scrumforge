import { useState } from 'react';

/**
 * @interface HappinessSurveyProps
 * @description Props del componente de encuesta de satisfacción del sprint.
 */
interface HappinessSurveyProps {
  /** Nombre legible del sprint, mostrado como subtítulo en la encuesta. */
  sprintName: string;
  /** ID único del sprint, usado como clave en localStorage para evitar duplicados. */
  sprintId: string;
  /** Callback invocado cuando el usuario envía su valoración y comentario opcionales. */
  onSubmit: (rating: number, comment: string) => void;
  /** Callback invocado cuando el usuario decide omitir la encuesta sin responder. */
  onSkip: () => void;
}

/**
 * Opciones de valoración con emoji, valor numérico y etiqueta de accesibilidad.
 * Se usan valores del 1 al 5 para mantener una escala Likert estándar de satisfacción.
 */
const EMOJIS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Muy mal' },
  { value: 2, emoji: '😕', label: 'Mal' },
  { value: 3, emoji: '😐', label: 'Regular' },
  { value: 4, emoji: '🙂', label: 'Bien' },
  { value: 5, emoji: '😄', label: 'Excelente' },
];

/**
 * @component HappinessSurvey
 * @description Modal de encuesta de felicidad del equipo al cierre de un sprint.
 *
 * Muestra un overlay de pantalla completa con una escala de emojis del 1 al 5
 * y un área de comentario opcional. Al enviar, persiste la respuesta en localStorage
 * con la clave `scrumforge_happiness_{sprintId}` para evitar que el usuario vea
 * la encuesta de nuevo si recarga la página, y luego delega al padre mediante `onSubmit`.
 *
 * El botón de envío permanece deshabilitado hasta que el usuario selecciona un emoji,
 * forzando una valoración mínima antes de continuar.
 *
 * @param {HappinessSurveyProps} props
 * @returns {JSX.Element} Overlay modal con la encuesta de satisfacción.
 */
export function HappinessSurvey({ sprintName, sprintId, onSubmit, onSkip }: HappinessSurveyProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  /**
   * Maneja el envío de la encuesta.
   * Guarda la respuesta en localStorage antes de invocar el callback del padre,
   * de modo que si el guardado falla (p. ej. modo privado sin almacenamiento),
   * el flujo continúa igualmente — los errores de storage se ignoran de forma silenciosa.
   */
  function handleSubmit() {
    if (rating === null) return;
    try {
      localStorage.setItem(
        `scrumforge_happiness_${sprintId}`,
        JSON.stringify({ rating, comment, submittedAt: new Date().toISOString() }),
      );
    } catch (_) {
      // Ignorar errores de almacenamiento (p. ej. cuota excedida o modo privado)
    }
    onSubmit(rating, comment);
  }

  // --- Estilos inline: se usan porque este componente es un overlay global
  // que no pertenece al flujo normal del layout y necesita posicionamiento fijo.

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const boxStyle: React.CSSProperties = {
    background: 'var(--color-surface, #1e1e2e)',
    borderRadius: '12px',
    padding: '2rem',
    width: '400px',
    maxWidth: '95vw',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    border: '1px solid var(--color-border, #3f3f5a)',
    color: 'var(--color-text, #e2e8f0)',
    textAlign: 'center',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: '0.35rem',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary, #94a3b8)',
    marginBottom: '1.5rem',
  };

  const emojisRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  };

  // Estilo base para cada botón de emoji; se extiende dinámicamente en el render
  // para mostrar el estado seleccionado (borde, escala y fondo con transparencia).
  const emojiButtonBase: React.CSSProperties = {
    background: 'none',
    border: '2px solid transparent',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '2rem',
    padding: '0.4rem 0.5rem',
    transition: 'border-color 0.15s, transform 0.1s',
    lineHeight: 1,
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '72px',
    borderRadius: '6px',
    border: '1px solid var(--color-border, #3f3f5a)',
    background: 'var(--color-surface-raised, #2a2a40)',
    color: 'var(--color-text, #e2e8f0)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    resize: 'vertical',
    marginBottom: '1.25rem',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  // El botón cambia visualmente cuando no hay rating para indicar que está bloqueado,
  // sin depender únicamente del atributo `disabled` (que en algunos navegadores no
  // aplica estilos de cursor de forma consistente).
  const submitButtonStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.6rem 1rem',
    borderRadius: '6px',
    border: 'none',
    background: rating !== null ? 'var(--color-primary, #6366f1)' : 'var(--color-border, #3f3f5a)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9375rem',
    cursor: rating !== null ? 'pointer' : 'not-allowed',
    marginBottom: '0.75rem',
    opacity: rating !== null ? 1 : 0.6,
  };

  const skipStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary, #94a3b8)',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    textDecoration: 'underline',
  };

  return (
    <div style={overlayStyle}>
      <div style={boxStyle}>
        <div style={titleStyle}>¿Cómo fue el sprint?</div>
        <div style={subtitleStyle}>Sprint: {sprintName}</div>

        {/* Fila de botones de emoji: cada uno aplica feedback visual al seleccionarse */}
        <div style={emojisRowStyle}>
          {EMOJIS.map(({ value, emoji, label }) => (
            <button
              key={value}
              style={{
                ...emojiButtonBase,
                // Resaltar el emoji seleccionado con borde, escala y fondo semitransparente
                borderColor: rating === value ? 'var(--color-primary, #6366f1)' : 'transparent',
                transform: rating === value ? 'scale(1.15)' : 'scale(1)',
                background: rating === value ? 'rgba(99,102,241,0.12)' : 'none',
              }}
              title={label}
              onClick={() => setRating(value)}
              aria-label={label}
            >
              {emoji}
            </button>
          ))}
        </div>

        <textarea
          style={textareaStyle}
          placeholder="¿Algo que mejorar? (opcional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <button style={submitButtonStyle} onClick={handleSubmit} disabled={rating === null}>
          Enviar
        </button>

        <button style={skipStyle} onClick={onSkip}>
          Saltar
        </button>
      </div>
    </div>
  );
}
