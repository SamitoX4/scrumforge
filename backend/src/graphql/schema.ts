/**
 * schema.ts — Construcción del schema GraphQL ejecutable.
 *
 * Este módulo centraliza la fusión de todos los typedefs y resolvers del core
 * con los de las extensiones premium registradas. La arquitectura de "schema
 * stitching" permite añadir nuevas capacidades sin modificar los módulos
 * existentes, siguiendo el principio Open/Closed.
 *
 * Flujo de construcción:
 *  1. `main.ts` llama a `loadExtensions()` → las extensiones habilitadas se
 *     registran en `extensionRegistry`.
 *  2. `main.ts` llama a `buildExecutableSchema(typeDefs, resolvers)` pasando
 *     los aportes de las extensiones.
 *  3. `buildExecutableSchema` fusiona core + extensiones con `mergeTypeDefs` /
 *     `mergeResolvers` y aplica la directiva `@auth` al schema resultante.
 *
 * Convención de tipedefs:
 *  - El schema base declara `Query`, `Mutation` y `Subscription` una sola vez.
 *  - Cada módulo extiende esos tipos con `extend type Query { ... }`.
 *  - Los escalares `DateTime` y `JSON` se registran aquí, no en cada módulo.
 */

import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { DocumentNode } from 'graphql';
import type { IResolvers } from '@graphql-tools/utils';
import { authDirectiveTypeDefs, applyAuthDirectives } from './directives/auth.directive';
import { dateScalarTypeDefs, dateScalarResolvers } from './scalars/date.scalar';
import { jsonScalarTypeDefs, jsonScalarResolvers } from './scalars/json.scalar';
import { userTypeDefs } from '../modules/user/user.typedefs';
import { authTypeDefs } from '../modules/auth/auth.typedefs';
import { workspaceTypeDefs } from '../modules/workspace/workspace.typedefs';
import { teamTypeDefs } from '../modules/team/team.typedefs';
import { projectTypeDefs } from '../modules/project/project.typedefs';
import { epicTypeDefs } from '../modules/epic/epic.typedefs';
import { userStoryTypeDefs } from '../modules/user-story/user-story.typedefs';
import { taskTypeDefs } from '../modules/task/task.typedefs';
import { sprintTypeDefs } from '../modules/sprint/sprint.typedefs';
import { reportsTypeDefs } from '../modules/reports/reports.typedefs';
import { commentTypeDefs } from '../modules/comment/comment.typedefs';
import { notificationTypeDefs } from '../modules/notification/notification.typedefs';
import { boardTypeDefs } from '../modules/board/board.typedefs';
import { emailVerificationTypeDefs } from '../modules/email-verification/email-verification.typedefs';
import { passwordResetTypeDefs } from '../modules/password-reset/password-reset.typedefs';
import { workspaceInvitationTypeDefs } from '../modules/workspace-invitation/workspace-invitation.typedefs';
import { impedimentTypeDefs } from '../modules/impediment/impediment.typedefs';
import { dodTypeDefs } from '../modules/definition-of-done/dod.typedefs';
import { auditTypeDefs } from '../modules/audit/audit.typedefs';
import { dependencyTypeDefs } from '../modules/dependencies/dependency.typedefs';
import { retroTypeDefs } from '../modules/retrospective/retro.typedefs';
import { userResolvers } from '../modules/user/user.resolver';
import { authResolvers } from '../modules/auth/auth.resolver';
import { workspaceResolvers } from '../modules/workspace/workspace.resolver';
import { teamResolvers } from '../modules/team/team.resolver';
import { projectResolvers } from '../modules/project/project.resolver';
import { epicResolvers } from '../modules/epic/epic.resolver';
import { userStoryResolvers } from '../modules/user-story/user-story.resolver';
import { taskResolvers } from '../modules/task/task.resolver';
import { sprintResolvers } from '../modules/sprint/sprint.resolver';
import { reportsResolvers } from '../modules/reports/reports.resolver';
import { commentResolvers } from '../modules/comment/comment.resolver';
import { notificationResolvers } from '../modules/notification/notification.resolver';
import { boardResolvers } from '../modules/board/board.resolver';
import { emailVerificationResolvers } from '../modules/email-verification/email-verification.resolver';
import { passwordResetResolvers } from '../modules/password-reset/password-reset.resolver';
import { workspaceInvitationResolvers } from '../modules/workspace-invitation/workspace-invitation.resolver';
import { impedimentResolvers } from '../modules/impediment/impediment.resolver';
import { dodResolvers } from '../modules/definition-of-done/dod.resolver';
import { auditResolvers } from '../modules/audit/audit.resolver';
import { dependencyResolvers } from '../modules/dependencies/dependency.resolver';
import { retroResolvers } from '../modules/retrospective/retro.resolver';

/**
 * Schema base — declara los tipos raíz Query, Mutation y Subscription una
 * sola vez. Cada módulo los extiende usando la sintaxis `extend type`.
 * Sin esta declaración base, `mergeTypeDefs` no puede fusionar las extensiones.
 */
const baseTypeDefs = `#graphql
  type Query
  type Mutation
  type Subscription
`;

/**
 * Construye el schema GraphQL ejecutable fusionando el core con las extensiones
 * premium registradas dinámicamente.
 *
 * La función es pura respecto a las extensiones: recibe los aportes de las
 * extensiones como parámetros en lugar de acceder al registro directamente,
 * lo que facilita el testing con distintas configuraciones de extensiones.
 *
 * @param extensionTypeDefs - DocumentNodes adicionales aportados por extensiones
 *   premium (planning-poker, ai, integrations, etc.). Por defecto array vacío.
 * @param extensionResolvers - Resolvers adicionales de las extensiones premium.
 *   Por defecto array vacío (schema solo con módulos del core).
 *
 * @returns Schema GraphQL ejecutable con la directiva `@auth` ya aplicada.
 *
 * Se llama desde `main.ts` después de que `loadExtensions()` registró las
 * extensiones habilitadas vía `ENABLED_EXTENSIONS`.
 */
export function buildExecutableSchema(
  extensionTypeDefs: DocumentNode[] = [],
  extensionResolvers: IResolvers[] = [],
) {
  // Fusionar todos los typedefs del core más los de extensiones.
  // mergeTypeDefs concatena y deduplica definiciones de tipos del mismo nombre,
  // permitiendo que los módulos usen `extend type Query` sin conflictos.
  const mergedTypeDefs = mergeTypeDefs([
    authDirectiveTypeDefs,   // Directivas @auth y @hasRole
    dateScalarTypeDefs,      // Escalar DateTime
    jsonScalarTypeDefs,      // Escalar JSON
    baseTypeDefs,            // Tipos raíz Query / Mutation / Subscription
    userTypeDefs,
    authTypeDefs,
    workspaceTypeDefs,
    teamTypeDefs,
    projectTypeDefs,
    epicTypeDefs,
    userStoryTypeDefs,
    taskTypeDefs,
    sprintTypeDefs,
    reportsTypeDefs,
    commentTypeDefs,
    notificationTypeDefs,
    boardTypeDefs,
    emailVerificationTypeDefs,
    passwordResetTypeDefs,
    workspaceInvitationTypeDefs,
    impedimentTypeDefs,
    dodTypeDefs,
    auditTypeDefs,
    dependencyTypeDefs,
    retroTypeDefs,
    // Los typedefs de extensiones se añaden al final para que puedan
    // extender tipos del core sin problemas de orden de declaración.
    ...extensionTypeDefs,
  ]);

  // Fusionar todos los resolvers del core más los de extensiones.
  // mergeResolvers combina los objetos de resolvers sin sobrescribir
  // resolvers del mismo tipo (los fusiona recursivamente).
  const mergedResolvers = mergeResolvers([
    dateScalarResolvers,   // Implementación del escalar DateTime
    jsonScalarResolvers,   // Implementación del escalar JSON
    userResolvers,
    authResolvers,
    workspaceResolvers,
    teamResolvers,
    projectResolvers,
    epicResolvers,
    userStoryResolvers,
    taskResolvers,
    sprintResolvers,
    reportsResolvers,
    commentResolvers,
    notificationResolvers,
    boardResolvers,
    emailVerificationResolvers,
    passwordResetResolvers,
    workspaceInvitationResolvers,
    impedimentResolvers,
    dodResolvers,
    auditResolvers,
    dependencyResolvers,
    retroResolvers,
    // Los resolvers de extensiones se añaden al final; en caso de colisión
    // de nombres, mergeResolvers lanza un error explícito.
    ...extensionResolvers,
  ]);

  // applyAuthDirectives transforma el schema aplicando la lógica de las
  // directivas @auth y @hasRole a cada campo que las tenga declaradas.
  return applyAuthDirectives(
    makeExecutableSchema({ typeDefs: mergedTypeDefs, resolvers: mergedResolvers }),
  );
}

/**
 * Schema por defecto construido sin extensiones externas.
 *
 * Se exporta para:
 *  - Compatibilidad con tests que no necesitan extensiones.
 *  - Importación síncrona desde `app.ts` durante la inicialización progresiva
 *    (cuando `main.ts` aún no ha pasado el schema enriquecido).
 *
 * En producción, `main.ts` llama a `buildExecutableSchema()` con las
 * extensiones cargadas y pasa el schema resultante a `createApp()`.
 */
export const executableSchema = buildExecutableSchema();
