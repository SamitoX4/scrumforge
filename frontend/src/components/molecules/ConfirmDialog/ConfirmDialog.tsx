import { createPortal } from 'react-dom';
import { Button } from '@/components/atoms/Button/Button';
import styles from './ConfirmDialog.module.scss';

/**
 * Props del componente ConfirmDialog.
 *
 * @property isOpen       - Controla la visibilidad del diálogo desde el componente padre.
 * @property title        - Título breve de la acción a confirmar.
 * @property message      - Descripción detallada de las consecuencias de la acción.
 * @property confirmLabel - Texto del botón de confirmación. Por defecto 'Confirmar'.
 * @property cancelLabel  - Texto del botón de cancelación. Por defecto 'Cancelar'.
 * @property variant      - 'danger' aplica estilos destructivos al botón de confirmación.
 * @property loading      - Cuando es true, muestra estado de carga y bloquea los botones.
 * @property onConfirm    - Callback ejecutado cuando el usuario confirma la acción.
 * @property onCancel     - Callback ejecutado cuando el usuario cancela o cierra el diálogo.
 */
export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' aplica estilos destructivos al botón de confirmación */
  variant?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmDialog — diálogo de confirmación accesible que reemplaza `window.confirm()`.
 *
 * Se renderiza mediante un portal en `document.body` para garantizar que el overlay
 * esté siempre por encima de cualquier otro elemento sin depender del z-index del
 * árbol de componentes padre.
 *
 * Flujo típico de uso:
 * 1. El padre mantiene un estado `showConfirm: boolean`.
 * 2. Abre el diálogo poniendo `isOpen={true}`.
 * 3. `onConfirm` ejecuta la acción destructiva y cierra el diálogo.
 * 4. `onCancel` simplemente cierra el diálogo sin hacer nada.
 *
 * Accesibilidad:
 * - `role="dialog"` y `aria-modal="true"` para lectores de pantalla.
 * - `aria-labelledby` y `aria-describedby` asocian título y mensaje al diálogo.
 *
 * @example
 * <ConfirmDialog
 *   isOpen={showDelete}
 *   title="Eliminar proyecto"
 *   message="Esta acción es irreversible."
 *   variant="danger"
 *   loading={deleting}
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowDelete(false)}
 * />
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Si el diálogo está cerrado no renderizamos nada, evitando el portal innecesario
  if (!isOpen) return null;

  return createPortal(
    // El overlay oscuro cubre toda la pantalla; el foco queda atrapado dentro del diálogo
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <div className={styles.dialog}>
        {/* Título asociado al diálogo vía aria-labelledby */}
        <h2 id="confirm-title" className={styles.title}>{title}</h2>
        {/* Descripción asociada vía aria-describedby */}
        <p id="confirm-message" className={styles.message}>{message}</p>

        <div className={styles.actions}>
          {/* Cancelar se deshabilita durante la carga para evitar doble clic accidental */}
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          {/* La variante del botón de confirmación refleja la severidad de la acción */}
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    // Se monta directamente en body para superar cualquier restricción de stacking context
    document.body,
  );
}
