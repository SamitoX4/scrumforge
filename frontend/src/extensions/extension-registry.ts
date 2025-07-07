import type React from 'react';
import type { WorkspacePlanLimits } from '@/types/api.types';

/**
 * Item de navegación que una extensión puede añadir al sidebar.
 */
export interface FrontendNavItem {
  icon: string;
  key: string;
  /** Clave i18n para el label (ej. 'nav.wiki') */
  navKey: string;
  /** Constante de ROUTES (ej. ROUTES.WIKI) */
  route: string;
  /** Si está definida, el item muestra un lock cuando el plan no lo incluye */
  planFeature?: keyof WorkspacePlanLimits;
}

/**
 * Ruta de página completa que una extensión registra en el router.
 */
export interface FrontendRouteConfig {
  /** Ruta relativa al workspace, ej. 'projects/:projectId/wiki' */
  path: string;
  component: React.LazyExoticComponent<React.ComponentType>;
}

/**
 * Contrato que debe exportar cada paquete de extensión premium de UI.
 */
export interface ScrumForgeFrontendExtension {
  /** Identificador único, ej. 'planning-poker', 'wiki' */
  name: string;
  /** Versión semver */
  version: string;
  /** Items que esta extensión añade al sidebar de navegación */
  navItems?: FrontendNavItem[];
  /** Rutas de página completa que registra en el router */
  routes?: FrontendRouteConfig[];
  /**
   * Slots inline: componentes lazy que reemplazan puntos específicos del core.
   * Si el slot no está registrado, el core muestra UpgradePrompt o null.
   *
   * Ejemplos de slots definidos en el core:
   *   'planning-poker-panel'              → SprintPlanningView
   *   'retro-vote-button'                 → RetrospectivesView
   *   'retro-realtime-sync'               → RetrospectivesView
   *   'reports-cfd-tab'                   → ReportsView
   *   'reports-lead-cycle-tab'            → ReportsView
   *   'reports-risks-tab'                 → ReportsView
   *   'reports-daily-tab'                 → ReportsView
   *   'reports-export-csv-btn'            → ReportsView
   *   'story-suggest-points-btn'          → UserStoryDetailPanel
   *   'story-generate-criteria-btn'       → UserStoryDetailPanel
   *   'anthropic-key-settings'            → ProjectSettingsPage
   *   'workspace-settings-integrations-tab' → WorkspaceSettingsPage
   *   'workspace-settings-billing-tab'    → WorkspaceSettingsPage
   */
  slots?: Record<string, React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>>;
}

/**
 * Registro central de extensiones de UI.
 * Se puebla en bootstrap (main.tsx) antes de montar React.
 * Solo lectura después del montaje — nunca registres en caliente.
 */
class FrontendExtensionRegistry {
  private readonly extensions = new Map<string, ScrumForgeFrontendExtension>();

  register(ext: ScrumForgeFrontendExtension): void {
    if (this.extensions.has(ext.name)) {
      throw new Error(
        `[FrontendExtensionRegistry] La extensión '${ext.name}' ya está registrada.`,
      );
    }
    this.extensions.set(ext.name, ext);
    console.info(`[FrontendExtensionRegistry] ✅ Registrada: ${ext.name}@${ext.version}`);
  }

  getAll(): ScrumForgeFrontendExtension[] {
    return Array.from(this.extensions.values());
  }

  has(name: string): boolean {
    return this.extensions.has(name);
  }

  /** Todos los nav items aportados por extensiones, en orden de registro. */
  getNavItems(): FrontendNavItem[] {
    return this.getAll().flatMap((ext) => ext.navItems ?? []);
  }

  /** Todas las rutas aportadas por extensiones. */
  getRoutes(): FrontendRouteConfig[] {
    return this.getAll().flatMap((ext) => ext.routes ?? []);
  }

  /**
   * Devuelve el componente lazy para un slot, o undefined si ninguna
   * extensión lo ha registrado (el core mostrará UpgradePrompt o null).
   */
  getSlot(
    name: string,
  ): React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>> | undefined {
    for (const ext of this.getAll()) {
      if (ext.slots?.[name]) return ext.slots[name];
    }
    return undefined;
  }

  /** Solo para tests: reinicia el registro. */
  _reset(): void {
    this.extensions.clear();
  }
}

/** Singleton global — se puebla en main.tsx antes de montar la app. */
export const frontendExtensionRegistry = new FrontendExtensionRegistry();

// Exportamos la clase para tests que necesiten instancias aisladas
export { FrontendExtensionRegistry };
