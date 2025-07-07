/**
 * Contrato para la extensión premium de Retrospectivas.
 *
 * Extiende el CRUD básico del core con funcionalidades colaborativas:
 *   - Dot voting anónimo sobre tarjetas (una persona, un voto por tarjeta).
 *   - Conversión de acciones de mejora en historias de usuario del siguiente sprint.
 *   - Revisión de acciones pendientes de retrospectivas anteriores.
 *   - Exportación estructurada de la retrospectiva completa.
 *
 * La implementación concreta vive en `RetroService` del módulo core del SDK,
 * pero los métodos premium se activan solo cuando la extensión está cargada.
 */

/**
 * Tarjeta (nota) de una retrospectiva en una columna del tablero.
 *
 * Las columnas típicas de una retrospectiva son:
 *   - `went_well`: Qué salió bien (Start/Keep).
 *   - `to_improve`: Qué mejorar (Stop/Try).
 *   - `action_items`: Acciones concretas de mejora.
 *
 * El campo `authorId` es nullable para soportar tarjetas anónimas,
 * donde el moderador ha activado el modo de escritura anónima.
 */
export interface RetroNote {
  /** Identificador único de la tarjeta. */
  id: string;
  /** Retrospectiva a la que pertenece esta tarjeta. */
  retroId: string;
  /** Columna del tablero en la que aparece la tarjeta. */
  column: string;
  /** Contenido textual de la tarjeta. */
  content: string;
  /** Número de votos de dot voting recibidos por esta tarjeta. */
  votes: number;
  /**
   * ID del autor de la tarjeta, o `null` si fue creada de forma anónima.
   * Las tarjetas anónimas no permiten identificar al autor ni en BD.
   */
  authorId: string | null;
  /** Momento en que se creó la tarjeta. */
  createdAt: Date;
}

/**
 * Acción de mejora acordada al final de una retrospectiva.
 *
 * Las acciones pueden convertirse en historias de usuario del siguiente sprint
 * mediante `convertActionToStory`, lo que garantiza que los compromisos de
 * mejora continua entren en el backlog y no queden como notas informales.
 */
export interface RetroAction {
  /** Identificador único de la acción. */
  id: string;
  /** Retrospectiva de la que surgió esta acción. */
  retroId: string;
  /** Título breve de la acción de mejora. */
  title: string;
  /** ID del responsable de ejecutar la acción, o null si sin asignar. */
  assigneeId: string | null;
  /** Fecha límite para completar la acción, o null si no tiene plazo. */
  dueDate: Date | null;
  /**
   * ID de la historia de usuario creada a partir de esta acción.
   * `null` si la acción aún no ha sido convertida en historia.
   */
  convertedToStoryId: string | null;
  /** Indica si la acción ha sido completada. */
  done: boolean;
}

/**
 * Contrato de operaciones premium de retrospectiva.
 * Estas operaciones extienden el CRUD básico del core y requieren
 * plan Pro o superior para estar disponibles.
 */
export interface IRetrospectiveExtension {
  /**
   * Añade un voto de dot voting a una tarjeta de retrospectiva.
   *
   * Regla: un usuario solo puede votar una vez por tarjeta. Si ya votó,
   * el voto se ignora o se devuelve la nota sin cambios (idempotente).
   *
   * @param retroId - Retrospectiva a la que pertenece la tarjeta.
   * @param noteId - Tarjeta que recibe el voto.
   * @param userId - Usuario que emite el voto.
   * @returns La tarjeta actualizada con el nuevo conteo de votos.
   */
  voteOnNote(retroId: string, noteId: string, userId: string): Promise<RetroNote>;

  /**
   * Retira el voto de dot voting de un usuario en una tarjeta.
   *
   * Permite deshacer un voto accidental. Si el usuario no había votado,
   * la operación es idempotente y devuelve la nota sin cambios.
   *
   * @param retroId - Retrospectiva a la que pertenece la tarjeta.
   * @param noteId - Tarjeta de la que se retira el voto.
   * @param userId - Usuario que retira su voto.
   * @returns La tarjeta actualizada con el conteo de votos reducido.
   */
  unvoteOnNote(retroId: string, noteId: string, userId: string): Promise<RetroNote>;

  /**
   * Convierte una acción de mejora en una UserStory del siguiente sprint.
   *
   * El título de la historia coincide con el título de la acción.
   * La historia queda en estado TODO con la historia vinculada a `targetSprintId`.
   * La acción queda marcada con `convertedToStoryId` para evitar duplicados.
   *
   * @param actionId - ID de la acción de mejora a convertir.
   * @param targetSprintId - Sprint al que se añadirá la historia resultante.
   * @param requestingUserId - Usuario que solicita la conversión (para el audit log).
   * @returns Datos básicos de la historia creada (id, title, sprintId).
   */
  convertActionToStory(
    actionId: string,
    targetSprintId: string,
    requestingUserId: string,
  ): Promise<{ id: string; title: string; sprintId: string }>;

  /**
   * Devuelve las acciones pendientes de retrospectivas anteriores del proyecto
   * para revisarlas en la retro actual ("¿Cumplimos lo que acordamos?").
   *
   * Solo devuelve acciones con `done: false` y `convertedToStoryId: null`,
   * excluyendo las acciones de la retrospectiva actual.
   *
   * @param projectId - Proyecto cuyas retrospectivas anteriores se consultan.
   */
  getPendingActions(projectId: string): Promise<RetroAction[]>;

  /**
   * Exporta la retrospectiva completa como un objeto JSON estructurado.
   *
   * El objeto exportado incluye:
   *   - Metadatos de la retrospectiva (fecha, nombre, sprint).
   *   - Todas las tarjetas agrupadas por columna con sus votos.
   *   - Todas las acciones de mejora con su estado de completitud.
   *
   * Útil para archivar retrospectivas en wikis o compartir con stakeholders.
   *
   * @param retroId - ID de la retrospectiva a exportar.
   * @returns Objeto JavaScript listo para serializar como JSON.
   */
  exportRetrospective(retroId: string): Promise<object>;
}
