import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client/react';
import { useNavigate, useParams } from 'react-router-dom';
import { GET_WORKSPACES } from '@/graphql/workspace/workspace.queries';
import type { Workspace } from '@/types/api.types';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import styles from './WorkspaceSelector.module.scss';

/**
 * @interface WorkspaceSelectorProps
 * @description Props del selector de workspace en la barra lateral.
 */
interface WorkspaceSelectorProps {
  /**
   * Indica si la barra lateral está en modo colapsado.
   * En este modo solo se muestra el avatar con las iniciales,
   * ocultando el nombre y el chevron para ahorrar espacio.
   */
  collapsed?: boolean;
}

/**
 * @component WorkspaceSelector
 * @description Selector desplegable de workspace ubicado en la cabecera de la barra lateral.
 *
 * Permite al usuario cambiar entre los workspaces a los que tiene acceso,
 * o crear uno nuevo. Es el punto de entrada principal para la navegación
 * multi-tenant de ScrumForge.
 *
 * Comportamiento:
 * - El workspace activo se deriva del parámetro de URL `workspaceSlug` (fuente de verdad),
 *   con fallback al primero de la lista si la URL no coincide con ninguno conocido.
 * - Las iniciales del workspace (hasta 2 palabras) se calculan dinámicamente para el avatar.
 * - Al seleccionar un workspace se navega a `/{slug}` manteniendo la URL como estado canónico.
 * - El dropdown se cierra automáticamente al hacer clic fuera o al pulsar Escape.
 * - En modo colapsado solo se muestra el avatar; el dropdown completo está deshabilitado
 *   para evitar que se abra en un espacio insuficiente.
 * - Si no hay workspaces cargados, el componente no renderiza nada (estado inicial de carga).
 *
 * Accesibilidad:
 * - El botón trigger declara `aria-haspopup="listbox"` y `aria-expanded`.
 * - La lista usa `role="listbox"` con ítems `role="option"` y `aria-selected`.
 * - En modo colapsado, el `title` del botón muestra el nombre completo como tooltip nativo.
 *
 * @param {WorkspaceSelectorProps} props
 * @returns {JSX.Element | null} Selector con dropdown, o null si no hay workspaces.
 */
export function WorkspaceSelector({ collapsed = false }: WorkspaceSelectorProps) {
  // Estado de visibilidad del dropdown de selección
  const [open, setOpen] = useState(false);

  // Controla la apertura del modal de creación de workspace
  const [showCreate, setShowCreate] = useState(false);

  // Ref al contenedor raíz para detectar clics fuera del componente
  const containerRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const { data } = useQuery<any>(GET_WORKSPACES);
  const workspaces: Workspace[] = data?.workspaces ?? [];

  // El workspace activo se determina por el slug de la URL, no por estado interno.
  // Esto garantiza que si el usuario navega directamente a una URL, el selector
  // refleje correctamente el workspace correspondiente sin sincronización adicional.
  const activeWorkspace = workspaces.find((w) => w.slug === workspaceSlug) ?? workspaces[0];

  // Cierre del dropdown al hacer clic fuera del componente.
  // El listener se registra solo cuando el dropdown está abierto para minimizar
  // el overhead de eventos globales cuando no son necesarios.
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Cierre del dropdown al pulsar Escape, siguiendo el patrón estándar de accesibilidad
  // para componentes tipo listbox/combobox (WAI-ARIA).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  /**
   * Cambia al workspace seleccionado navegando a su slug.
   * El cierre del dropdown ocurre antes de la navegación para evitar
   * que el dropdown quede visible durante la transición de página.
   */
  function handleSelect(workspace: Workspace) {
    setOpen(false);
    navigate(`/${workspace.slug}`);
  }

  // No renderizar mientras los workspaces aún no se han cargado
  if (workspaces.length === 0) return null;

  // Calcular las iniciales del workspace activo para el avatar circular.
  // Se toman hasta 2 palabras del nombre para evitar avatares demasiado largos.
  const initials = activeWorkspace
    ? activeWorkspace.name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div ref={containerRef} className={styles.container}>
      {/* Botón trigger: muestra el avatar siempre, y nombre + chevron solo en modo expandido */}
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        // En modo colapsado, el title actúa como tooltip nativo para accesibilidad
        title={collapsed ? (activeWorkspace?.name ?? 'Workspace') : undefined}
      >
        <span className={styles.avatar}>{initials}</span>
        {!collapsed && (
          <>
            <span className={styles.name}>{activeWorkspace?.name ?? 'Workspace'}</span>
            <span className={styles.chevron} aria-hidden>
              {open ? '▲' : '▼'}
            </span>
          </>
        )}
      </button>

      {/* Dropdown de selección: solo se renderiza en modo expandido y cuando está abierto */}
      {open && !collapsed && (
        <ul className={styles.menu} role="listbox" aria-label="Seleccionar workspace">
          {workspaces.map((workspace) => (
            <li key={workspace.id} role="option" aria-selected={workspace.slug === workspaceSlug}>
              <button
                className={styles.menuItem}
                data-active={workspace.slug === workspaceSlug}
                onClick={() => handleSelect(workspace)}
              >
                {/* Las iniciales de cada ítem se calculan igual que las del trigger */}
                <span className={styles.menuAvatar}>
                  {workspace.name
                    .split(' ')
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </span>
                <div className={styles.menuInfo}>
                  <span className={styles.menuName}>{workspace.name}</span>
                  <span className={styles.menuSlug}>{workspace.slug}</span>
                </div>
                {/* Checkmark de confirmación en el workspace actualmente activo */}
                {workspace.slug === workspaceSlug && <span className={styles.check}>✓</span>}
              </button>
            </li>
          ))}

          {/* Separador visual entre la lista de workspaces y la acción de crear */}
          <li role="none" className={styles.divider} aria-hidden />

          {/* Opción para crear un workspace nuevo: cierra el dropdown antes de abrir el modal */}
          <li role="none">
            <button
              className={styles.menuItem}
              onClick={() => { setOpen(false); setShowCreate(true); }}
            >
              <span className={styles.menuAvatar} style={{ background: 'rgba(255,255,255,0.15)' }}>+</span>
              <div className={styles.menuInfo}>
                <span className={styles.menuName}>Nuevo workspace</span>
              </div>
            </button>
          </li>
        </ul>
      )}

      {/* Modal de creación: montado siempre pero controlado por isOpen para mantener
          el estado del formulario aunque el dropdown se abra y cierre */}
      <CreateWorkspaceModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
