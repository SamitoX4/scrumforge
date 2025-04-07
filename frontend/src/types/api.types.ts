/**
 * @file api.types.ts
 *
 * Tipos TypeScript que reflejan el esquema GraphQL del backend de ScrumForge.
 *
 * Cada interfaz o tipo aquí definido corresponde a un tipo o enum del schema de Prisma/GraphQL.
 * Esto garantiza consistencia entre el modelo de datos del servidor y el cliente,
 * permitiendo tipar correctamente las respuestas de Apollo Client sin necesidad
 * de generar código automáticamente con codegen.
 *
 * Convención de nombres:
 * - Los tipos escalares de GraphQL (String, Int, etc.) se mapean a sus equivalentes TS.
 * - Los campos de fecha se representan como `string` (ISO 8601) porque GraphQL
 *   los serializa como cadenas; la conversión a `Date` se hace en los componentes que lo necesiten.
 * - Los campos opcionales en el schema GraphQL se tipan como `T | null` o `T | undefined | null`.
 */

/**
 * Prioridad de una historia de usuario o épica.
 * Ordenadas de mayor a menor urgencia: CRITICAL > HIGH > MEDIUM > LOW.
 */
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Estado de una historia de usuario dentro del flujo de trabajo.
 * Representa las columnas del tablero Kanban en orden de progresión.
 */
export type StoryStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

/**
 * Estado del ciclo de vida de un sprint.
 * - PLANNING: el sprint está siendo planificado; acepta historias por drag-and-drop.
 * - ACTIVE: sprint en curso; solo puede haber uno activo por proyecto.
 * - COMPLETED: sprint cerrado; sus estadísticas contribuyen al cálculo de velocidad.
 */
export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED';

/**
 * Rol de un miembro dentro de un equipo.
 * Determina los permisos de acceso a distintas operaciones del proyecto.
 */
export type TeamRole = 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPER' | 'STAKEHOLDER';

/**
 * Usuario registrado en ScrumForge.
 * El campo `anthropicApiKey` se omite intencionadamente: nunca se expone por GraphQL.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  /** URL del avatar alojado externamente (p.ej. Google OAuth) o null si usa el avatar por defecto. */
  avatarUrl?: string | null;
  /** Indica si el usuario ha verificado su email; requerido para ciertas acciones. */
  emailVerified: boolean;
  /** Fecha de creación en formato ISO 8601. */
  createdAt: string;
}

/** Límites y flags de features del plan activo del workspace. */
export interface WorkspacePlanLimits {
  /** Acceso al módulo de Planning Poker. */
  planningPoker?: boolean;
  /** Acceso a reportes avanzados (burndown, velocity, etc.). */
  advancedReports?: boolean;
  /** Acceso a integraciones externas (GitHub, Slack, Jira). */
  integrations?: boolean;
  /** Acceso a las funcionalidades de IA (sugerencias, estimación automática, etc.). */
  ai?: boolean;
  /** Acceso al módulo de retrospectivas. */
  retrospective?: boolean;
  /** Acceso al módulo de wiki del proyecto. */
  wiki?: boolean;
  /** Número máximo de proyectos permitidos; null = sin límite. */
  maxProjects?: number | null;
  /** Número máximo de miembros por equipo; null = sin límite. */
  maxMembers?: number | null;
  /** Almacenamiento total disponible en MB; null = sin límite. */
  storageMb?: number | null;
  /** Número de sprints del historial de velocidad disponibles; null = sin límite. */
  sprintHistory?: number | null;
  /** Permite acceder a cualquier feature adicional definida dinámicamente en el backend. */
  [key: string]: unknown;
}

/**
 * Workspace (tenant) de ScrumForge.
 * Es el contenedor de nivel más alto; agrupa equipos y proyectos bajo un plan de suscripción.
 */
export interface Workspace {
  id: string;
  name: string;
  /** Slug único usado en la URL del workspace (p.ej. `mi-empresa`). */
  slug: string;
  /** ID del usuario propietario del workspace (tiene permisos de administración total). */
  ownerId: string;
  createdAt: string;
  teams: Team[];
  /** Límites del plan activo, consultados para mostrar/ocultar features en la UI. */
  planLimits: WorkspacePlanLimits;
}

/**
 * Equipo dentro de un workspace.
 * Agrupa miembros y proyectos; un usuario puede pertenecer a varios equipos.
 */
export interface Team {
  id: string;
  name: string;
  workspaceId: string;
  members: TeamMember[];
  projects: Project[];
}

/**
 * Relación entre un usuario y un equipo, con el rol que desempeña en él.
 */
export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
  /** Fecha en que el usuario se unió al equipo (ISO 8601). */
  joinedAt: string;
  /** Datos del usuario embebidos para evitar queries adicionales en la UI. */
  user: User;
}

/**
 * Proyecto ágil dentro de un equipo.
 * Contiene el backlog (épicas e historias) y los sprints.
 */
export interface Project {
  id: string;
  name: string;
  /** Prefijo corto del proyecto (p.ej. "SF") usado para identificar historias. */
  key: string;
  teamId: string;
  /** Configuración serializada como JSON string (p.ej. límites WIP por columna). */
  settings: string;
  createdAt: string;
  team: Team;
  epics: Epic[];
  sprints: Sprint[];
}

/**
 * Épica: agrupación temática de historias de usuario.
 * Tiene un color propio que se muestra como chip en las tarjetas del tablero.
 */
export interface Epic {
  id: string;
  title: string;
  description?: string | null;
  projectId: string;
  priority: Priority;
  /** Color hexadecimal (p.ej. `#3B82F6`) para identificación visual en el tablero. */
  color: string;
  /** Posición de la épica en la lista del backlog (orden manual). */
  order: number;
  createdAt: string;
  userStories: UserStory[];
}

/**
 * Historia de usuario: unidad de trabajo principal del backlog.
 *
 * Una historia pertenece a un proyecto y opcionalmente a una épica y un sprint.
 * Puede estar bloqueada (`isBlocked`), en cuyo caso `blockedReason` describe
 * el impedimento que impide su avance.
 */
export interface UserStory {
  id: string;
  title: string;
  description?: string | null;
  /** Si es null, la historia no pertenece a ninguna épica. */
  epicId?: string | null;
  projectId: string;
  /** Si es null, la historia está en el backlog sin sprint asignado. */
  sprintId?: string | null;
  status: StoryStatus;
  /** Story points estimados; null si la historia aún no ha sido estimada. */
  points?: number | null;
  priority: Priority;
  /** ID del usuario asignado; null si no está asignado a nadie. */
  assigneeId?: string | null;
  /** Posición en la lista del backlog o dentro del sprint (orden manual). */
  order: number;
  /** True si hay un impedimento activo que bloquea el progreso de la historia. */
  isBlocked: boolean;
  /** Descripción del impedimento; solo tiene valor cuando `isBlocked` es true. */
  blockedReason?: string | null;
  /** Campos personalizados definidos por el equipo (p.ej. enlace a Figma, ticket de soporte). */
  customFields?: Record<string, unknown> | null;
  createdAt: string;
  /** Épica embebida para mostrar el chip de color sin queries adicionales. */
  epic?: Epic | null;
  sprint?: Sprint | null;
  /** Usuario asignado embebido para mostrar el avatar en la tarjeta del tablero. */
  assignee?: User | null;
  tasks: Task[];
}

/**
 * Tarea técnica asociada a una historia de usuario.
 * Representa el trabajo concreto de implementación (p.ej. "Crear endpoint REST").
 */
export interface Task {
  id: string;
  title: string;
  description?: string | null;
  userStoryId: string;
  status: StoryStatus;
  assigneeId?: string | null;
  /** Fecha límite de la tarea en formato ISO 8601; null si no tiene plazo. */
  dueDate?: string | null;
  /** Posición dentro de la lista de tareas de la historia. */
  order: number;
  createdAt: string;
  assignee?: User | null;
}

/**
 * Sprint: iteración temporal del equipo para completar un conjunto de historias.
 *
 * Las fechas (`startDate`, `endDate`) son null en sprints PLANNING hasta que
 * se inicia formalmente el sprint. El campo `stats` es calculado por el servidor
 * y no se almacena directamente en la base de datos.
 */
export interface Sprint {
  id: string;
  name: string;
  /** Objetivo del sprint; puede quedar vacío si el equipo no lo define. */
  goal?: string | null;
  projectId: string;
  /** Fecha de inicio (ISO 8601); null mientras el sprint está en PLANNING. */
  startDate?: string | null;
  /** Fecha de fin planificada (ISO 8601); null mientras el sprint está en PLANNING. */
  endDate?: string | null;
  status: SprintStatus;
  createdAt: string;
  userStories: UserStory[];
  /** Métricas calculadas en tiempo real por el servidor sobre las historias del sprint. */
  stats: SprintStats;
}

/**
 * Estadísticas agregadas de un sprint, calculadas dinámicamente por el resolver.
 * Se usan en la vista de planificación (barra de capacidad) y en los reportes.
 */
export interface SprintStats {
  /** Suma de story points de todas las historias del sprint. */
  totalPoints: number;
  /** Suma de story points de las historias en estado DONE. */
  completedPoints: number;
  /** Número total de historias en el sprint. */
  totalStories: number;
  /** Número de historias en estado DONE. */
  completedStories: number;
  /** Porcentaje de historias completadas (0–100). */
  progressPercent: number;
}

/**
 * Payload devuelto tras autenticarse correctamente (login o refresh token).
 * El `accessToken` se almacena en memoria (Zustand); el `refreshToken` se guarda
 * en una cookie HttpOnly para mayor seguridad.
 */
export interface AuthPayload {
  /** JWT de corta duración para autorizar peticiones GraphQL. */
  accessToken: string;
  /** Token de larga duración para renovar el accessToken sin reautenticarse. */
  refreshToken: string;
  user: User;
}
