/**
 * Contrato para la extensión de Inteligencia Artificial.
 *
 * El core solo define la interfaz; la implementación concreta usa el SDK de
 * Anthropic y vive en la extensión `@scrumforge/ext-ai` (ai.service.ts).
 *
 * Este módulo de interfaces actúa como barrera de abstracción: si en el futuro
 * se reemplaza Anthropic por otro proveedor de IA, solo cambia la implementación
 * de `AiService` sin necesidad de tocar el core ni los resolvers.
 */

/**
 * Alerta de riesgo detectada en el sprint por el sistema de IA.
 * Contiene la información necesaria para que la UI presente el riesgo
 * de forma accionable: a qué historia afecta, por qué es un riesgo
 * y con qué urgencia debe atenderse.
 */
export interface RiskAlert {
  /** ID de la historia de usuario afectada. */
  storyId: string;
  /** Título de la historia, para mostrar en la UI sin necesidad de otra consulta. */
  storyTitle: string;
  /** Descripción del motivo del riesgo (ej. "Lleva 6 días sin moverse"). */
  reason: string;
  /** Nivel de criticidad del riesgo. */
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Momento en que se detectó el riesgo (para ordenar por recencia). */
  detectedAt: Date;
}

/**
 * Contrato de operaciones de IA que cualquier extensión de IA debe implementar.
 *
 * Todas las operaciones son asíncronas porque pueden involucrar llamadas
 * a APIs externas (Anthropic) con latencia variable.
 */
export interface IAIExtension {
  /**
   * Genera criterios de aceptación en formato Gherkin (Given/When/Then)
   * a partir del título y descripción de una historia.
   *
   * Devuelve un array de strings, uno por criterio de aceptación.
   * Cada elemento tiene el formato:
   *   `Given <contexto>\nWhen <acción>\nThen <resultado esperado>`
   *
   * @param storyTitle - Título de la historia de usuario.
   * @param description - Descripción que aporta contexto para la generación.
   * @param workspaceId - ID del workspace (para verificar cuota de plan).
   */
  generateAcceptanceCriteria(
    storyTitle: string,
    description: string,
    workspaceId: string,
  ): Promise<string[]>;

  /**
   * Sugiere story points para una historia comparándola con historias
   * similares del historial de proyectos del workspace.
   *
   * Devuelve `null` si no hay suficiente historial en el proyecto para
   * hacer una sugerencia significativa (menos de 3 historias completadas).
   *
   * @param storyId - ID de la historia a puntuar.
   * @param workspaceId - ID del workspace (para verificar cuota de plan).
   */
  suggestStoryPoints(storyId: string, workspaceId: string): Promise<number | null>;

  /**
   * Detecta historias con riesgo de no completarse en el sprint activo.
   *
   * Las reglas de detección incluyen:
   *   - Burndown desviado significativamente de la proyección ideal.
   *   - Tareas bloqueadas por más de N días sin resolución.
   *   - Historias sin actividad en el AuditLog por más de 5 días.
   *
   * @param sprintId - ID del sprint a analizar.
   * @param workspaceId - ID del workspace (para verificar cuota de plan).
   */
  detectRisks(sprintId: string, workspaceId: string): Promise<RiskAlert[]>;

  /**
   * Genera el resumen diario para el Daily Scrum en formato de bullet points.
   *
   * El resumen incluye:
   *   - Avances del día anterior (historias que pasaron a DONE o IN_REVIEW).
   *   - Plan del día actual (historias IN_PROGRESS).
   *   - Impedimentos activos (historias con `isBlocked: true`).
   *
   * @param sprintId - ID del sprint activo a resumir.
   * @param workspaceId - ID del workspace (para verificar cuota de plan).
   */
  generateDailySummary(sprintId: string, workspaceId: string): Promise<string>;
}
