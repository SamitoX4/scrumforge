import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './DropdownMenu.module.scss';

/**
 * Representa un ítem individual dentro del menú desplegable.
 *
 * @property label   - Texto visible del ítem.
 * @property icon    - Emoji o símbolo opcional mostrado a la izquierda del label.
 * @property variant - 'danger' aplica estilos destructivos (color rojo) al ítem.
 * @property action  - Callback ejecutado cuando el usuario hace clic en el ítem.
 */
export interface DropdownMenuItem {
  label: string;
  icon?: string;
  variant?: 'default' | 'danger';
  action: () => void;
}

/**
 * Props del componente DropdownMenu.
 *
 * @property trigger - Elemento React que actúa como botón de apertura/cierre del menú.
 * @property items   - Lista de ítems que se muestran en el menú.
 * @property align   - Alineación del menú respecto al trigger: 'right' (default) o 'left'.
 */
interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  /** Alineación del menú respecto al trigger */
  align?: 'left' | 'right';
}

/**
 * DropdownMenu — menú desplegable contextual con posicionamiento absoluto via portal.
 *
 * El menú se renderiza en un portal (`document.body`) para evitar que contenedores
 * con `overflow: hidden` o `z-index` bajo corten visualmente el menú. La posición
 * se calcula en el momento del clic usando `getBoundingClientRect()` del trigger.
 *
 * Comportamiento de cierre:
 * - Clic fuera del trigger y del menú → `mousedown` listener en el documento.
 * - Tecla `Escape` → `keydown` listener en el documento.
 * Ambos listeners se registran solo mientras el menú está abierto y se limpian
 * automáticamente en el cleanup del efecto para evitar memory leaks.
 *
 * Integración con dnd-kit:
 * El `onPointerDown` en el trigger llama a `stopPropagation()` para que dnd-kit
 * no inicie un drag al hacer clic en el botón de menú contextual de una tarjeta.
 *
 * @example
 * <DropdownMenu
 *   trigger={<button>⋮</button>}
 *   items={[
 *     { label: 'Editar', icon: '✏️', action: handleEdit },
 *     { label: 'Eliminar', icon: '🗑', variant: 'danger', action: handleDelete },
 *   ]}
 *   align="right"
 * />
 */
export function DropdownMenu({ trigger, items, align = 'right' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  // Posición absoluta del menú en coordenadas de la ventana + scroll
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cierra el menú al hacer clic fuera del trigger o del propio menú
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    // Limpieza del listener cuando el menú se cierra o el componente se desmonta
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Cierra el menú al presionar Escape — estándar de accesibilidad para menús
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  function handleTriggerClick(e: React.MouseEvent) {
    // Evita que el clic burbujee hacia contenedores que puedan cerrarlo
    e.stopPropagation();
    e.preventDefault();
    if (!triggerRef.current) return;

    // Calculamos la posición del menú relativa al viewport + desplazamiento de scroll
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 4; // 4px de separación visual
    const left = align === 'right'
      ? rect.right + window.scrollX - 160 // anchura aproximada del menú ~160px
      : rect.left + window.scrollX;
    setMenuPos({ top, left });
    setOpen((v) => !v); // alterna abierto/cerrado
  }

  function handleItemClick(item: DropdownMenuItem) {
    // Cerramos primero para que la animación de cierre ocurra antes de la acción
    setOpen(false);
    item.action();
  }

  return (
    <>
      {/* Wrapper del trigger — captura el ref y detiene eventos problemáticos */}
      <div
        ref={triggerRef}
        className={styles.trigger}
        onClick={handleTriggerClick}
        onPointerDown={(e) => e.stopPropagation()} // evita que dnd-kit inicie un drag
      >
        {trigger}
      </div>

      {/* El portal evita problemas de overflow/z-index en el árbol de componentes */}
      {open && createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          style={{ top: menuPos.top, left: menuPos.left }}
          role="menu"
        >
          {items.map((item, i) => (
            <button
              key={i}
              className={`${styles.item} ${item.variant === 'danger' ? styles['item--danger'] : ''}`}
              onClick={() => handleItemClick(item)}
              role="menuitem"
            >
              {/* El icono es decorativo — aria-hidden evita que los lectores lo anuncien */}
              {item.icon && <span className={styles.icon} aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
