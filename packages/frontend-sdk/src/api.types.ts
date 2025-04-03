/**
 * Límites y características habilitadas según el plan de suscripción del workspace.
 *
 * Este tipo se usa tanto en el frontend como en las extensiones del SDK para
 * verificar qué funcionalidades están disponibles antes de renderizarlas,
 * evitando llamadas al backend innecesarias.
 *
 * Los campos booleanos indican si la funcionalidad está disponible en el plan.
 * Los campos numéricos con `| null` indican un límite absoluto (null = sin límite).
 * El índice `[key: string]: unknown` permite añadir límites personalizados
 * en extensiones sin romper la compatibilidad del tipo base.
 */
export interface WorkspacePlanLimits {
  /** Habilita la funcionalidad de Planning Poker. */
  planningPoker?: boolean;
  /** Habilita los reportes avanzados (CFD, Lead/Cycle Time, etc.). */
  advancedReports?: boolean;
  /** Habilita las integraciones externas (GitHub, Slack, etc.). */
  integrations?: boolean;
  /** Habilita las funcionalidades de inteligencia artificial. */
  ai?: boolean;
  /** Habilita el módulo de retrospectivas. */
  retrospective?: boolean;
  /** Habilita el módulo de wiki del proyecto. */
  wiki?: boolean;
  /** Número máximo de proyectos permitidos (null = sin límite). */
  maxProjects?: number | null;
  /** Número máximo de miembros por workspace (null = sin límite). */
  maxMembers?: number | null;
  /** Almacenamiento máximo en megabytes (null = sin límite). */
  storageMb?: number | null;
  /** Número de sprints históricos accesibles en reportes (null = sin límite). */
  sprintHistory?: number | null;
  /** Límites adicionales definidos por extensiones del SDK. */
  [key: string]: unknown;
}
