/**
 * @file ai.queries.ts
 * @module graphql/ai
 * @description Operaciones GraphQL para las funcionalidades de Inteligencia Artificial de ScrumForge.
 * Incluye mutaciones que invocan el modelo de IA (claude-haiku) para generar contenido,
 * y queries para obtener análisis e insights del estado del proyecto y sprint.
 *
 * El backend prioriza la API key de Anthropic del usuario autenticado; si no existe,
 * usa la clave de entorno del servidor. Estas operaciones NUNCA exponen la clave por GraphQL.
 */

import { gql } from '@apollo/client';

/**
 * @constant GENERATE_ACCEPTANCE_CRITERIA
 * @description Mutación que solicita al modelo de IA la generación automática de criterios de aceptación
 * para una historia de usuario a partir de su título y descripción opcional.
 * El resultado es un string formateado listo para mostrar o insertar en la historia.
 *
 * @param {String} storyTitle - Título de la historia de usuario (requerido).
 * @param {String} [storyDescription] - Descripción adicional de la historia (opcional, mejora la precisión).
 *
 * @returns {String} Criterios de aceptación generados por la IA en formato texto.
 */
export const GENERATE_ACCEPTANCE_CRITERIA = gql`
  mutation GenerateAcceptanceCriteria($storyTitle: String!, $storyDescription: String) {
    generateAcceptanceCriteria(storyTitle: $storyTitle, storyDescription: $storyDescription)
  }
`;

/**
 * @constant SUGGEST_STORY_POINTS
 * @description Mutación que solicita al modelo de IA una estimación de story points
 * para una historia de usuario. El contexto del proyecto (historias previas estimadas)
 * se usa en el backend para calibrar la sugerencia.
 *
 * @param {String} storyTitle - Título de la historia a estimar.
 * @param {ID} projectId - ID del proyecto, usado para obtener contexto histórico de estimaciones.
 *
 * @returns {String} Estimación sugerida de story points con justificación breve.
 */
export const SUGGEST_STORY_POINTS = gql`
  mutation SuggestStoryPoints($storyTitle: String!, $projectId: ID!) {
    suggestStoryPoints(storyTitle: $storyTitle, projectId: $projectId)
  }
`;

/**
 * @constant SPRINT_RISKS
 * @description Query que analiza el sprint indicado y retorna una lista de riesgos detectados por la IA.
 * Evalúa factores como carga de trabajo, impedimentos activos, historias bloqueadas y velocidad histórica.
 *
 * @param {ID} sprintId - Identificador del sprint a analizar.
 *
 * @returns {Array<Object>} Lista de riesgos, cada uno con:
 * - `type` — Categoría del riesgo (ej. CAPACITY, DEPENDENCY, BLOCKER).
 * - `message` — Descripción legible del riesgo detectado.
 * - `severity` — Nivel de gravedad (ej. LOW, MEDIUM, HIGH).
 */
export const SPRINT_RISKS = gql`
  query SprintRisks($sprintId: ID!) {
    sprintRisks(sprintId: $sprintId) { type message severity }
  }
`;

/**
 * @constant DAILY_SUMMARY
 * @description Query que genera un resumen diario del estado del proyecto usando IA.
 * Consolida información de tareas completadas, en progreso, impedimentos y notas relevantes
 * para facilitar la Daily Scrum o informes de seguimiento.
 *
 * @param {ID} projectId - Identificador del proyecto para el que se genera el resumen.
 *
 * @returns {String} Texto del resumen diario generado por la IA.
 */
export const DAILY_SUMMARY = gql`
  query DailySummary($projectId: ID!) {
    dailySummary(projectId: $projectId)
  }
`;

/**
 * @constant AUTOMATION_SUGGESTIONS
 * @description Query que solicita a la IA sugerencias de automatización para el proyecto.
 * Analiza patrones de uso y propone reglas de automatización que podrían ahorrar tiempo al equipo
 * (ej. mover tarjetas automáticamente al cerrar PRs, notificar en ciertos eventos, etc.).
 *
 * @param {ID} projectId - Identificador del proyecto a analizar.
 *
 * @returns {Array<Object>} Lista de sugerencias de automatización, cada una con:
 * - `trigger` — Evento que dispararía la automatización (ej. "story.status_changed").
 * - `action` — Acción recomendada a ejecutar.
 * - `description` — Explicación legible de la sugerencia en lenguaje natural.
 */
export const AUTOMATION_SUGGESTIONS = gql`
  query AutomationSuggestions($projectId: ID!) {
    automationSuggestions(projectId: $projectId) { trigger action description }
  }
`;
