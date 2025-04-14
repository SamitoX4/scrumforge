import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useApolloClient } from '@apollo/client/react';
import { useUIStore } from '@/store/ui.store';
import { ROUTES, buildRoute } from '@/constants/routes';
import { GET_BACKLOG, GET_EPICS } from '@/graphql/backlog/backlog.queries';
import { statusLabel } from '@/utils/color.utils';
import type { UserStory, Epic } from '@/types/api.types';
import styles from './CommandPalette.module.scss';

/**
 * Resultado individual de búsqueda que se muestra en la paleta.
 *
 * @property id       - Clave única para el renderizado de lista.
 * @property label    - Texto principal del resultado.
 * @property sublabel - Texto secundario con información adicional (estado, puntos, etc.).
 * @property icon     - Emoji que identifica visualmente la categoría del resultado.
 * @property category - Nombre del grupo al que pertenece el resultado (Navegar, Épicas, etc.).
 * @property action   - Función ejecutada al seleccionar el resultado (navega a la ruta).
 */
interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  icon: string;
  category: string;
  action: () => void;
}

/**
 * Iconos por clave de ruta para mantener consistencia visual
 * con la navegación del sidebar.
 */
const NAV_ICON: Record<string, string> = {
  backlog:   '📋',
  board:     '🗂',
  planning:  '📅',
  reports:   '📊',
  settings:  '⚙️',
  dashboard: '🏠',
};

/**
 * CommandPalette — paleta de comandos global de búsqueda y navegación rápida.
 *
 * Se abre con Cmd/Ctrl+K (gestionado en App.tsx) y se monta como portal en
 * `document.body` para no heredar restricciones de z-index o overflow.
 *
 * Fuentes de datos:
 * - **Navegación**: links estáticos a las secciones del proyecto/workspace actual.
 * - **Épicas**: leídas de la caché de Apollo sin realizar llamadas de red adicionales.
 * - **Historias de usuario**: igual que épicas, desde la caché local de Apollo.
 *
 * El acceso a la caché se hace con `client.readQuery()` dentro de `useMemo`,
 * lo que evita peticiones de red y aprovecha los datos ya cargados. Si la
 * caché no contiene los datos, se devuelve un array vacío sin error.
 *
 * Navegación por teclado:
 * - `ArrowDown` / `ArrowUp` → mueve el ítem activo.
 * - `Enter` → ejecuta la acción del ítem activo y cierra la paleta.
 * - `Escape` → cierra la paleta sin navegar.
 * - Mouse hover → actualiza el ítem activo para coherencia visual.
 *
 * Los resultados se agrupan por categoría para mejorar la legibilidad.
 * Dentro de cada categoría se limita el número de resultados (épicas: 5, historias: 8)
 * para que la lista no sea demasiado larga.
 */
export function CommandPalette() {
  const { closeCommandPalette } = useUIStore();
  const [query, setQuery] = useState('');
  // Índice del resultado actualmente resaltado para navegación por teclado
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { projectId, workspaceSlug } = useParams<{ projectId: string; workspaceSlug: string }>();
  // Cliente Apollo para leer la caché local sin llamadas de red
  const client = useApolloClient();

  // Enfoca el input automáticamente al montar la paleta
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reinicia el índice activo cada vez que cambia la búsqueda para evitar
  // que el índice apunte a un resultado que ya no existe
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  /**
   * Lee las épicas del proyecto desde la caché de Apollo.
   * Se incluye `query` en las dependencias para re-evaluar cuando el usuario escribe,
   * ya que Apollo puede haber añadido datos a la caché mientras se escribía.
   */
  const epics = useMemo<Epic[]>(() => {
    if (!projectId) return [];
    try {
      const data = client.readQuery<{ epics: Epic[] }>({
        query: GET_EPICS,
        variables: { projectId },
      });
      return data?.epics ?? [];
    } catch {
      // readQuery lanza si la query no está en caché — devolvemos vacío silenciosamente
      return [];
    }
  }, [client, projectId, query]); // re-check cache on every query change

  /**
   * Lee las historias de usuario del backlog desde la caché de Apollo.
   * Mismo patrón que las épicas: caché primero, array vacío como fallback.
   */
  const stories = useMemo<UserStory[]>(() => {
    if (!projectId) return [];
    try {
      const data = client.readQuery<{ backlog: UserStory[] }>({
        query: GET_BACKLOG,
        variables: { projectId },
      });
      return data?.backlog ?? [];
    } catch {
      return [];
    }
  }, [client, projectId, query]);

  /** Cierra la paleta y limpia la búsqueda para la próxima apertura */
  const close = useCallback(() => {
    closeCommandPalette();
    setQuery('');
  }, [closeCommandPalette]);

  /**
   * Calcula la lista completa de resultados combinando navegación, épicas e historias.
   * Se recalcula solo cuando cambia la búsqueda, los datos de caché o el contexto de ruta.
   */
  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();

    // ── Navegación rápida ────────────────────────────────────────────────────
    // Los items de navegación varían según si hay un proyecto activo en la URL
    const ws = workspaceSlug ?? '';
    const navItems: SearchResult[] = projectId
      ? [
          { id: 'nav-backlog', label: 'Ir a Backlog', icon: NAV_ICON.backlog, category: 'Navegar', sublabel: 'Product Backlog del proyecto', action: () => navigate(buildRoute(ROUTES.BACKLOG, { workspaceSlug: ws, projectId })) },
          { id: 'nav-board', label: 'Ir al Tablero', icon: NAV_ICON.board, category: 'Navegar', sublabel: 'Kanban Board del sprint activo', action: () => navigate(buildRoute(ROUTES.BOARD, { workspaceSlug: ws, projectId })) },
          { id: 'nav-planning', label: 'Ir a Planificación', icon: NAV_ICON.planning, category: 'Navegar', sublabel: 'Sprint Planning', action: () => navigate(buildRoute(ROUTES.SPRINT_PLANNING, { workspaceSlug: ws, projectId })) },
          { id: 'nav-reports', label: 'Ir a Reportes', icon: NAV_ICON.reports, category: 'Navegar', sublabel: 'Burndown y velocidad', action: () => navigate(buildRoute(ROUTES.REPORTS, { workspaceSlug: ws, projectId })) },
          { id: 'nav-settings', label: 'Ir a Configuración', icon: NAV_ICON.settings, category: 'Navegar', sublabel: 'Ajustes del proyecto', action: () => navigate(buildRoute(ROUTES.PROJECT_SETTINGS, { workspaceSlug: ws, projectId })) },
        ]
      : [
          { id: 'nav-dashboard', label: 'Ir al Dashboard', icon: NAV_ICON.dashboard, category: 'Navegar', sublabel: 'Inicio', action: () => workspaceSlug && navigate(buildRoute(ROUTES.DASHBOARD, { workspaceSlug })) },
          { id: 'nav-ws', label: 'Configuración del workspace', icon: NAV_ICON.settings, category: 'Navegar', action: () => workspaceSlug && navigate(buildRoute(ROUTES.WORKSPACE_SETTINGS, { workspaceSlug })) },
        ];

    // ── Épicas ───────────────────────────────────────────────────────────────
    // Se limita a 5 resultados para no saturar la paleta; navegan al backlog
    const epicItems: SearchResult[] = epics
      .filter((e) => !q || e.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map((e) => ({
        id: `epic-${e.id}`,
        label: e.title,
        icon: '🔷',
        category: 'Épicas',
        sublabel: e.priority,
        action: () => {
          if (projectId) navigate(buildRoute(ROUTES.BACKLOG, { workspaceSlug: ws, projectId }));
        },
      }));

    // ── Historias de usuario ─────────────────────────────────────────────────
    // Se limita a 8 resultados; también navegan al backlog (donde se puede abrir el detalle)
    const storyItems: SearchResult[] = stories
      .filter((s) => !q || s.title.toLowerCase().includes(q))
      .slice(0, 8)
      .map((s) => ({
        id: `story-${s.id}`,
        label: s.title,
        icon: '📌',
        category: 'Historias',
        sublabel: `${statusLabel(s.status)} · ${s.points ?? '?'} pts`,
        action: () => {
          if (projectId) navigate(buildRoute(ROUTES.BACKLOG, { workspaceSlug: ws, projectId }));
        },
      }));

    // La navegación solo se filtra cuando hay búsqueda activa para no saturar resultados
    const filteredNav = q
      ? navItems.filter((n) => n.label.toLowerCase().includes(q) || n.sublabel?.toLowerCase().includes(q))
      : navItems;

    return [...filteredNav, ...epicItems, ...storyItems];
  }, [query, epics, stories, navigate, projectId]);

  /** Gestiona la navegación por teclado dentro de la paleta */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault(); // evita que el cursor del input se mueva
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[activeIndex]) {
      results[activeIndex].action();
      close();
    }
  }

  function handleResultClick(result: SearchResult) {
    result.action();
    close();
  }

  /**
   * Agrupa los resultados por categoría para mostrarlos con cabeceras de sección.
   * Se usa Map para preservar el orden de inserción de las categorías.
   */
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.category) ?? [];
      arr.push(r);
      map.set(r.category, arr);
    }
    return map;
  }, [results]);

  return createPortal(
    // El overlay cubre toda la pantalla; hacer clic en él cierra la paleta
    <div className={styles.overlay} onClick={close} role="dialog" aria-modal="true" aria-label="Paleta de comandos">
      {/* stopPropagation evita que clicks dentro del panel cierren la paleta */}
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        {/* Campo de búsqueda — recibe el foco al montar */}
        <div className={styles.searchRow}>
          <span className={styles.searchIcon} aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar o escribir un comando..."
            aria-label="Búsqueda global"
            autoComplete="off"
          />
          {/* Botón para limpiar la búsqueda rápidamente */}
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
              ✕
            </button>
          )}
        </div>

        {/* Lista de resultados agrupada por categoría */}
        <div className={styles.results} role="listbox">
          {results.length === 0 && (
            <p className={styles.empty}>Sin resultados para "{query}"</p>
          )}

          {[...grouped.entries()].map(([category, items]) => (
            <div key={category} className={styles.group}>
              {/* Cabecera del grupo — identifica visualmente la categoría */}
              <p className={styles.groupLabel}>{category}</p>
              {items.map((result) => {
                // Índice global para la navegación por teclado (el activeIndex es global, no por grupo)
                const globalIndex = results.indexOf(result);
                return (
                  <button
                    key={result.id}
                    className={`${styles.result} ${globalIndex === activeIndex ? styles['result--active'] : ''}`}
                    onClick={() => handleResultClick(result)}
                    // hover actualiza el activeIndex para coherencia teclado/ratón
                    onMouseEnter={() => setActiveIndex(globalIndex)}
                    role="option"
                    aria-selected={globalIndex === activeIndex}
                  >
                    <span className={styles.resultIcon} aria-hidden="true">{result.icon}</span>
                    <span className={styles.resultContent}>
                      <span className={styles.resultLabel}>{result.label}</span>
                      {result.sublabel && (
                        <span className={styles.resultSublabel}>{result.sublabel}</span>
                      )}
                    </span>
                    {/* Hint de "Enter" solo visible en el ítem activo */}
                    {globalIndex === activeIndex && (
                      <span className={styles.enterHint} aria-hidden="true">↵</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Leyenda de atajos de teclado disponibles */}
        <div className={styles.footer}>
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>↵</kbd> seleccionar</span>
          <span><kbd>Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
