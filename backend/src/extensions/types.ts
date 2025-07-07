import type { DomainEvent } from '../events/event-store';
import type { EventType } from '../events/event-types';

/**
 * Tipo público del EventBus que se expone a las extensiones.
 * Las extensiones usan `subscribe` para reaccionar a eventos del core
 * y `publish` para emitir eventos propios.
 */
export interface EventBus {
  subscribe(type: EventType, handler: (event: DomainEvent) => void | Promise<void>): void;
  publish(event: DomainEvent): Promise<void>;
}

// Re-exportamos EventType para que las extensiones no necesiten importar
// directamente desde el módulo interno de eventos.
export { EventType } from '../events/event-types';
