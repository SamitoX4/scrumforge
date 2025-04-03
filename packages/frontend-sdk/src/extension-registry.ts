/**
 * @file extension-registry.ts
 * @description Contratos de tipado del sistema de extensiones del frontend de ScrumForge.
 *
 * Define las interfaces que deben implementar las extensiones frontend para
 * registrarse en el sistema de plugins de la aplicación. Una extensión puede
 * aportar elementos de navegación lateral, rutas lazy-loaded y componentes
 * inyectables en slots predefinidos de la UI.
 *
 * El registro de extensiones se realiza en tiempo de arranque de la aplicación
 * (típicamente en `App.tsx`), donde cada extensión activa se recorre para
 * montar sus rutas y renderizar sus items de navegación.
 */

import type React from 'react';
import type { WorkspacePlanLimits } from './api.types';

/**
 * Describe un elemento de navegación lateral aportado por una extensión.
 *
 * Cada `FrontendNavItem` se traduce en una entrada visible en el sidebar de la
 * aplicación. El campo `planFeature` permite ocultar o deshabilitar el item
 * cuando el plan del workspace activo no incluye la funcionalidad asociada.
 */
export interface FrontendNavItem {
  /** Nombre del icono que se muestra junto al texto del item (p. ej. nombre de icono Lucide). */
  icon: string;
  /** Clave única interna del item; se usa como `key` en el renderizado de React. */
  key: string;
  /** Clave de navegación activa; se compara con la ruta actual para marcar el item como activo. */
  navKey: string;
  /** Ruta de la aplicación a la que navega el item al ser pulsado. */
  route: string;
  /**
   * Clave de la funcionalidad del plan asociada a este item (opcional).
   * Si se especifica, el item solo se muestra cuando el plan del workspace
   * incluye dicha funcionalidad (verificado contra `WorkspacePlanLimits`).
   */
  planFeature?: keyof WorkspacePlanLimits;
}

/**
 * Describe una ruta lazy-loaded aportada por una extensión frontend.
 *
 * El componente se importa de forma diferida mediante `React.lazy` para
 * evitar que el bundle inicial de la aplicación crezca con código de
 * extensiones que el usuario puede no necesitar.
 */
export interface FrontendRouteConfig {
  /** Patrón de ruta compatible con React Router (p. ej. `/planning-poker/:projectId`). */
  path: string;
  /** Componente React cargado de forma diferida que se renderiza cuando la ruta coincide. */
  component: React.LazyExoticComponent<React.ComponentType>;
}

/**
 * Contrato principal que debe implementar cualquier extensión del frontend de ScrumForge.
 *
 * Una extensión puede contribuir tres tipos de artefactos a la aplicación:
 *   - `navItems` — entradas en el sidebar de navegación lateral.
 *   - `routes`   — rutas React Router montadas en el router principal.
 *   - `slots`    — componentes inyectados en puntos de extensión predefinidos de la UI.
 *
 * Ejemplo de registro mínimo:
 * ```ts
 * const myExtension: ScrumForgeFrontendExtension = {
 *   name: 'my-feature',
 *   version: '1.0.0',
 *   navItems: [...],
 *   routes: [...],
 * };
 * ```
 */
export interface ScrumForgeFrontendExtension {
  /** Nombre único de la extensión. Se usa como identificador en el registro. */
  name: string;
  /** Versión semántica de la extensión (p. ej. `'1.2.0'`). */
  version: string;
  /**
   * Lista de items de navegación lateral que aporta la extensión (opcional).
   * Se añaden al sidebar de la aplicación respetando el orden del array.
   */
  navItems?: FrontendNavItem[];
  /**
   * Lista de rutas React Router que aporta la extensión (opcional).
   * Se registran en el router principal de la aplicación junto a las rutas del core.
   */
  routes?: FrontendRouteConfig[];
  /**
   * Mapa de componentes inyectables en slots de la UI predefinidos (opcional).
   * La clave del mapa es el nombre del slot (p. ej. `'sprintHeader'`) y el
   * valor es el componente lazy-loaded que se renderiza en ese punto.
   * Los componentes de slot aceptan un objeto de props genérico `Record<string, unknown>`.
   */
  slots?: Record<string, React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>>;
}
