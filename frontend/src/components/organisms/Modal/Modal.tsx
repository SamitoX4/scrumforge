import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import styles from './Modal.module.scss';
import { Button } from '@/components/atoms/Button/Button';

/**
 * Props del componente Modal.
 *
 * @property isOpen   - Controla la visibilidad del modal desde el componente padre.
 * @property onClose  - Callback ejecutado al cerrar (Escape, clic en overlay o botón ✕).
 * @property title    - Título del modal, anunciado por lectores de pantalla via aria-labelledby.
 * @property children - Contenido del cuerpo del modal.
 * @property size     - Ancho máximo del modal. Por defecto 'md'.
 * @property footer   - Slot opcional para botones de acción en el pie del modal.
 */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
}

/**
 * Modal — ventana modal base reutilizable con trampa de foco y cierre por teclado.
 *
 * Se renderiza mediante un portal en `document.body` para superar cualquier
 * restricción de stacking context (z-index, overflow) en el árbol de componentes.
 *
 * Comportamientos implementados:
 * - **Tecla Escape** → cierra el modal via listener en `document`.
 * - **Clic en overlay** → cierra el modal (solo cuando el clic es directamente
 *   sobre el overlay, no sobre el contenido del modal, gracias a la comparación
 *   con `overlayRef.current`).
 * - **Bloqueo de scroll** → mientras el modal está abierto, `body.style.overflow`
 *   se pone en 'hidden' para evitar el scroll de fondo. Se restaura al cerrar.
 *
 * Accesibilidad:
 * - `role="dialog"` y `aria-modal="true"` para lectores de pantalla.
 * - `aria-labelledby="modal-title"` asocia el título al diálogo.
 * - El botón de cierre tiene `aria-label="Cerrar"` explícito.
 *
 * @example
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Crear historia">
 *   <StoryForm onSave={handleSave} />
 * </Modal>
 *
 * // Con footer de acciones
 * <Modal
 *   isOpen={open}
 *   onClose={handleClose}
 *   title="Confirmar"
 *   footer={<Button onClick={handleConfirm}>Confirmar</Button>}
 * >
 *   ¿Estás seguro?
 * </Modal>
 */
export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  // Referencia al overlay para detectar clics directamente sobre él (no sobre el contenido)
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);
    // Bloquea el scroll del cuerpo mientras el modal está abierto
    document.body.style.overflow = 'hidden';

    return () => {
      // Limpieza: restaura el scroll y elimina el listener al cerrar o desmontar
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Renderizado condicional fuera del portal para evitar el overhead del portal cuando está cerrado
  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      // Cierra solo si el clic es directamente sobre el overlay (no sobre el modal)
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={clsx(styles.modal, styles[`modal--${size}`])}>
        <header className={styles.header}>
          {/* El id "modal-title" es referenciado por aria-labelledby del overlay */}
          <h2 id="modal-title" className={styles.title}>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </Button>
        </header>

        <div className={styles.body}>{children}</div>

        {/* El footer es opcional — se renderiza solo cuando se proporciona */}
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
