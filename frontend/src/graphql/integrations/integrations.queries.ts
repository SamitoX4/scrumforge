/**
 * @file integrations.queries.ts
 * @module graphql/integrations
 * @description Operaciones GraphQL para las integraciones externas de ScrumForge.
 * Cubre tres tipos de integración:
 *   1. **Webhooks** — Registro y gestión de endpoints externos que reciben eventos del workspace.
 *   2. **Slack** — Configuración del webhook de Slack para notificaciones del equipo.
 *   3. **GitHub** — Vinculación de repositorios y consulta de actividad de commits.
 *
 * Estas integraciones permiten conectar ScrumForge con el ecosistema de herramientas del equipo.
 */

import { gql } from '@apollo/client';

/**
 * @constant LIST_WEBHOOKS
 * @description Query que obtiene todos los webhooks registrados para un workspace.
 * Permite gestionar endpoints externos que recibirán notificaciones de eventos de ScrumForge.
 *
 * @param {ID} workspaceId - Identificador del workspace cuyos webhooks se listan.
 *
 * @returns {Array<Object>} Lista de webhooks con:
 * - `id` — Identificador único del webhook.
 * - `workspaceId` — Workspace propietario del webhook.
 * - `url` — URL del endpoint externo que recibe los eventos.
 * - `events` — Lista de tipos de eventos suscritos (ej. ["story.created", "sprint.started"]).
 * - `active` — Indica si el webhook está activo y recibiendo notificaciones.
 * - `createdAt` — Fecha de registro del webhook.
 */
export const LIST_WEBHOOKS = gql`
  query ListWebhooks($workspaceId: ID!) {
    listWebhooks(workspaceId: $workspaceId) { id workspaceId url events active createdAt }
  }
`;

/**
 * @constant REGISTER_WEBHOOK
 * @description Mutación para registrar un nuevo webhook en un workspace.
 * El campo `secret` es opcional y permite al receptor verificar la autenticidad
 * de las notificaciones mediante firma HMAC incluida en los headers del request.
 *
 * @param {ID} workspaceId - Workspace al que pertenece el webhook.
 * @param {String} url - URL del endpoint externo que recibirá los eventos.
 * @param {[String!]!} events - Lista de eventos a los que suscribirse.
 * @param {String} [secret] - Secreto opcional para verificar la firma de los payloads.
 *
 * @returns {Object} Webhook creado con: `id`, `url`, `events`, `active`.
 */
export const REGISTER_WEBHOOK = gql`
  mutation RegisterWebhook($workspaceId: ID!, $url: String!, $events: [String!]!, $secret: String) {
    registerWebhook(workspaceId: $workspaceId, url: $url, events: $events, secret: $secret) { id url events active }
  }
`;

/**
 * @constant DELETE_WEBHOOK
 * @description Mutación para eliminar un webhook registrado en el workspace.
 * Una vez eliminado, el endpoint dejará de recibir notificaciones de eventos.
 *
 * @param {ID} id - Identificador del webhook a eliminar.
 *
 * @returns {Boolean} `true` si el webhook fue eliminado correctamente.
 */
export const DELETE_WEBHOOK = gql`
  mutation DeleteWebhook($id: ID!) { deleteWebhook(id: $id) }
`;

/**
 * @constant CONFIGURE_SLACK
 * @description Mutación para configurar la URL del Incoming Webhook de Slack para un workspace.
 * Una vez configurado, ScrumForge enviará notificaciones de eventos relevantes al canal
 * de Slack asociado al webhook (ej. inicio de sprint, nuevos impedimentos, etc.).
 *
 * Diseño: se almacena una sola URL de webhook por workspace (no por proyecto), lo que
 * centraliza las notificaciones en un canal de equipo común.
 *
 * @param {ID} workspaceId - Workspace para el que se configura la integración con Slack.
 * @param {String} webhookUrl - URL del Incoming Webhook de Slack proporcionada por la app de Slack.
 *
 * @returns {Boolean} `true` si la configuración fue guardada correctamente.
 */
export const CONFIGURE_SLACK = gql`
  mutation ConfigureSlack($workspaceId: ID!, $webhookUrl: String!) { configureSlack(workspaceId: $workspaceId, webhookUrl: $webhookUrl) }
`;

/**
 * @constant GITHUB_ACTIVITY
 * @description Query que obtiene la actividad reciente de commits del repositorio de GitHub
 * vinculado a un proyecto. Permite al equipo ver el progreso del desarrollo directamente
 * desde el tablero de ScrumForge sin salir de la aplicación.
 *
 * @param {ID} projectId - Identificador del proyecto cuya actividad de GitHub se consulta.
 *
 * @returns {Array<Object>} Lista de commits recientes, cada uno con:
 * - `sha` — Hash del commit en Git.
 * - `message` — Mensaje del commit.
 * - `author` — Nombre del autor del commit.
 * - `date` — Fecha del commit.
 * - `url` — URL del commit en GitHub para abrir en el navegador.
 */
export const GITHUB_ACTIVITY = gql`
  query GithubActivity($projectId: ID!) {
    githubActivity(projectId: $projectId) { sha message author date url }
  }
`;

/**
 * @constant GITHUB_LINKED_REPO
 * @description Query que obtiene la URL del repositorio de GitHub vinculado a un proyecto.
 * Retorna null si el proyecto no tiene un repositorio vinculado aún.
 * Usada para mostrar el estado de la integración y el enlace al repositorio en la UI.
 *
 * @param {ID} projectId - Identificador del proyecto a consultar.
 *
 * @returns {String | null} URL del repositorio de GitHub vinculado, o null si no existe.
 */
export const GITHUB_LINKED_REPO = gql`
  query GithubLinkedRepo($projectId: ID!) { githubLinkedRepo(projectId: $projectId) }
`;

/**
 * @constant LINK_GITHUB_REPO
 * @description Mutación para vincular un repositorio de GitHub a un proyecto de ScrumForge.
 * Una vez vinculado, se puede consultar la actividad de commits mediante `GITHUB_ACTIVITY`.
 * Solo admite un repositorio por proyecto; llamar esta mutación de nuevo reemplaza el anterior.
 *
 * @param {ID} projectId - Identificador del proyecto al que se vincula el repositorio.
 * @param {String} repoUrl - URL del repositorio de GitHub (ej. "https://github.com/org/repo").
 *
 * @returns {Boolean} `true` si el repositorio fue vinculado correctamente.
 */
export const LINK_GITHUB_REPO = gql`
  mutation LinkGithubRepo($projectId: ID!, $repoUrl: String!) { linkGithubRepo(projectId: $projectId, repoUrl: $repoUrl) }
`;
