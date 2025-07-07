/**
 * Contrato para proveedores de integraciones externas.
 *
 * Cada proveedor (GitHub, Slack, Webhook, Calendar...) implementa
 * `IIntegrationProvider`. La extensión `@scrumforge/ext-integrations`
 * registra los proveedores disponibles en un `IIntegrationRegistry`.
 *
 * Este modelo de registro permite añadir nuevos proveedores sin modificar
 * el core: basta con implementar la interfaz y registrar el proveedor
 * en el `onInit` de la extensión correspondiente.
 */

/**
 * Evento interno de ScrumForge que los proveedores de integración
 * pueden recibir y reenviar a sistemas externos.
 *
 * El campo `type` actúa como discriminante para que cada proveedor
 * decida qué eventos le interesan. El `payload` es flexible para
 * acomodar distintos tipos de entidades (historias, sprints, etc.).
 */
export interface ScrumForgeEvent {
  /** Tipo de evento (ej. 'sprint.started', 'story.done'). */
  type: string;
  /** Datos del evento: ID y nombre de la entidad afectada como mínimo. */
  payload: Record<string, unknown>;
  /** Workspace en el que ocurrió el evento (para filtrar por workspace). */
  workspaceId: string;
  /** Proyecto en el que ocurrió el evento (para filtrar por proyecto). */
  projectId: string;
  /** Momento exacto en que ocurrió el evento. */
  occurredAt: Date;
}

/**
 * Resultado de validar la configuración de una integración.
 * Se usa en `validateConfig` para dar feedback detallado al usuario
 * si la configuración es incorrecta (token inválido, URL inaccesible, etc.).
 */
export interface ValidationResult {
  /** `true` si la configuración es válida y la integración puede funcionar. */
  valid: boolean;
  /** Mensaje de error legible para el usuario, presente solo si `valid` es false. */
  error?: string;
}

/**
 * Contrato que debe implementar cada proveedor de integración externa.
 *
 * Los proveedores pueden actuar en dos modos:
 *   - **Entrante** (incoming): reciben payloads del sistema externo vía webhook
 *     y los convierten en acciones de ScrumForge (ej. GitHub → crear tarea).
 *     Se implementa mediante `handleIncoming` (opcional).
 *   - **Saliente** (outgoing): reaccionan a eventos de ScrumForge y notifican
 *     al sistema externo (ej. ScrumForge → Slack). Se implementa mediante `sendEvent`.
 */
export interface IIntegrationProvider {
  /**
   * Identificador único e inmutable del proveedor.
   * Usado como clave en el registro y para persistir la configuración.
   * Ejemplos: `'github'`, `'gitlab'`, `'slack'`, `'webhook'`.
   */
  readonly type: string;

  /** Nombre legible del proveedor para mostrar en la UI de integraciones. */
  readonly displayName: string;

  /**
   * Valida que las credenciales/config de la integración son correctas
   * haciendo un request de prueba a la API del sistema externo.
   *
   * Se llama cuando el usuario guarda la configuración de una integración,
   * para dar feedback inmediato en lugar de fallar silenciosamente después.
   *
   * @param config - Configuración específica del proveedor (tokens, URLs, etc.).
   */
  validateConfig(config: Record<string, unknown>): Promise<ValidationResult>;

  /**
   * Maneja un payload entrante del sistema externo (ej. webhook de GitHub).
   *
   * El router de webhooks del core llama a este método con el body ya parseado.
   * La implementación debe ser idempotente: el sistema externo puede reenviar
   * el mismo evento varias veces.
   *
   * Este método es opcional porque no todos los proveedores tienen
   * webhooks entrantes (ej. Slack solo es saliente).
   *
   * @param payload - Body parseado del webhook entrante.
   * @param projectId - Proyecto al que se mapea el webhook.
   */
  handleIncoming?(payload: unknown, projectId: string): Promise<void>;

  /**
   * Reacciona a un evento de ScrumForge y lo reenvía al sistema externo.
   *
   * Ejemplos:
   *   - GitHub: crear un comentario en el PR asociado al sprint.
   *   - Slack: enviar un mensaje al canal del equipo.
   *   - Webhook: hacer un POST HTTP al endpoint configurado.
   *
   * @param event - Evento de ScrumForge con tipo, payload y metadatos.
   * @param config - Configuración específica del proveedor para este workspace.
   */
  sendEvent(event: ScrumForgeEvent, config: Record<string, unknown>): Promise<void>;
}

/**
 * Registro de proveedores de integración, indexado por `type`.
 *
 * El registro actúa como Service Locator: las extensiones registran sus
 * proveedores en el `onInit`, y el core los consulta al despachar eventos
 * o recibir webhooks entrantes.
 */
export interface IIntegrationRegistry {
  /**
   * Registra un nuevo proveedor en el registro.
   * Si ya existe un proveedor con el mismo `type`, lo sobreescribe.
   */
  register(provider: IIntegrationProvider): void;

  /**
   * Devuelve el proveedor con el `type` indicado, o `undefined` si no existe.
   * @param type - Identificador del proveedor (ej. 'github').
   */
  get(type: string): IIntegrationProvider | undefined;

  /** Devuelve todos los proveedores registrados. */
  getAll(): IIntegrationProvider[];
}
