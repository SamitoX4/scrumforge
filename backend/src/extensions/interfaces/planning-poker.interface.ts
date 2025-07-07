/**
 * Contrato que debe implementar cualquier extensión de Planning Poker.
 *
 * El core no implementa esta interfaz directamente; la extensión premium
 * `@scrumforge/ext-planning-poker` provee la implementación concreta
 * en `PokerService`.
 *
 * El flujo de una sesión de Planning Poker sigue estos estados:
 *   WAITING → VOTING → REVEALED → DONE
 *
 *   - WAITING:  La sesión está creada pero aún no han votado suficientes participantes.
 *   - VOTING:   Los participantes emiten sus votos (ocultos hasta que se revelen).
 *   - REVEALED: El host revela todas las cartas simultáneamente.
 *   - DONE:     Se acordó el consenso de puntos y se grabó en la historia.
 */

/**
 * Sesión de Planning Poker para estimar una historia de usuario.
 * Cada sesión corresponde a la estimación de una historia concreta
 * dentro de un sprint específico.
 */
export interface PokerSession {
  /** Identificador único de la sesión. */
  id: string;
  /** Sprint al que pertenece la sesión. */
  sprintId: string;
  /** Historia de usuario que se está estimando en esta sesión. */
  storyId: string;
  /** Estado actual de la sesión en el flujo de Planning Poker. */
  status: 'WAITING' | 'VOTING' | 'REVEALED' | 'DONE';
  /** Votos emitidos por los participantes en esta sesión. */
  votes: PokerVote[];
  /** Momento en que se creó la sesión. */
  createdAt: Date;
}

/**
 * Voto de un participante en una sesión de Planning Poker.
 * El campo `value` es `null` mientras la sesión no ha sido revelada,
 * para garantizar el anonimato de los votos hasta el momento de la revelación.
 * Una vez revelados, `value` contiene el valor de la carta elegida
 * (ej. '1', '2', '3', '5', '8', '13', '?', '∞').
 */
export interface PokerVote {
  /** ID del participante que emitió el voto. */
  userId: string;
  /**
   * Valor de la carta elegida, o `null` si la sesión aún no ha sido revelada.
   * El valor `null` permite confirmar que el usuario ha votado sin revelar su elección.
   */
  value: string | null;
  /** Momento en que se emitió el voto. */
  votedAt: Date;
}

/**
 * Contrato de operaciones de Planning Poker que el servicio debe implementar.
 * Todas las operaciones son asíncronas porque interactúan con la base de datos
 * y publican eventos en el sistema PubSub para actualizar la UI en tiempo real.
 */
export interface IPlanningPokerService {
  /**
   * Crea una nueva sesión de poker para estimar una historia en un sprint.
   *
   * Antes de crear la nueva sesión, cierra cualquier sesión activa existente
   * en el mismo proyecto (solo puede haber una sesión activa a la vez).
   *
   * @param sprintId - Sprint al que pertenece la sesión.
   * @param storyId - Historia de usuario a estimar.
   * @param hostUserId - Usuario que crea la sesión (tiene permisos de moderador).
   * @returns La sesión de poker recién creada en estado VOTING.
   */
  createSession(sprintId: string, storyId: string, hostUserId: string): Promise<PokerSession>;

  /**
   * Registra el voto de un participante en la sesión indicada.
   *
   * Si el participante ya había votado, su voto se actualiza (upsert).
   * Esto permite que los usuarios cambien de opinión antes de la revelación.
   *
   * @param sessionId - ID de la sesión en la que se vota.
   * @param userId - ID del usuario que vota.
   * @param value - Valor de la carta elegida (ej. '5', '8', '?').
   */
  castVote(sessionId: string, userId: string, value: string): Promise<void>;

  /**
   * Revela todas las cartas simultáneamente, cambiando el estado de la
   * sesión de VOTING a REVEALED.
   *
   * Solo el host de la sesión debería poder llamar a este método;
   * esa verificación de autorización la debe hacer el resolver.
   *
   * @param sessionId - ID de la sesión a revelar.
   * @returns La sesión actualizada con estado REVEALED y votos visibles.
   */
  revealVotes(sessionId: string, requestingUserId: string): Promise<PokerSession>;

  /**
   * Finaliza la sesión y graba el consenso de puntos en la historia de usuario.
   *
   * Cambia el estado de la sesión a DONE y actualiza el campo `points`
   * de la historia con el valor de consenso acordado por el equipo.
   *
   * @param sessionId - ID de la sesión a finalizar.
   * @param consensusPoints - Número de puntos acordados por el equipo.
   * @param requestingUserId - ID del usuario que finaliza (debe ser el host).
   */
  finalizeSession(
    sessionId: string,
    consensusPoints: number,
    requestingUserId: string,
  ): Promise<void>;

  /**
   * Elimina todas las sesiones de un sprint.
   *
   * Se llama cuando el sprint se cierra para limpiar sesiones incompletas
   * y mantener la base de datos limpia. Las sesiones en estado DONE
   * ya tienen sus puntos grabados en las historias y pueden eliminarse.
   *
   * @param sprintId - Sprint cuyas sesiones se van a eliminar.
   */
  cleanupSessions(sprintId: string): Promise<void>;

  /**
   * Devuelve la sesión activa de un sprint (en estado VOTING o REVEALED),
   * o `null` si no hay ninguna sesión activa en este momento.
   *
   * Se usa para reconectar a un usuario que se desconectó durante una sesión.
   *
   * @param sprintId - Sprint del que se busca la sesión activa.
   */
  getActiveSession(sprintId: string): Promise<PokerSession | null>;
}
