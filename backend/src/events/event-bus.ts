/**
 * @file event-bus.ts
 * @description Bus de eventos en memoria (patrón pub/sub) para desacoplar los módulos
 * del dominio. Los handlers se registran durante el arranque de la aplicación y reaccionan
 * a eventos publicados a lo largo del ciclo de vida de la sesión.
 *
 * NOTA: Este bus es volátil (no persiste eventos). Para trazabilidad e historial de cambios
 * usa {@link EventStore}. El EventBus está pensado para efectos secundarios ligeros:
 * notificaciones push, actualizaciones en tiempo real (WebSocket), métricas, etc.
 */

import { EventType } from './event-types';
import type { DomainEvent } from './event-store';
import { logger } from '../utils/logger';

/** Firma de un handler de evento de dominio. Puede ser síncrono o asíncrono. */
type EventHandler = (event: DomainEvent) => void | Promise<void>;

/**
 * EventBus — pub/sub en memoria para desacoplar módulos del dominio.
 * Los handlers se registran en el arranque de la aplicación.
 * Para eventos críticos usa EventStore (persistencia); EventBus es para
 * reacciones secundarias (notificaciones, actualizaciones en tiempo real).
 */
class EventBus {
  /** Mapa de tipo de evento a lista de handlers suscritos. */
  private readonly handlers = new Map<EventType, EventHandler[]>();

  /**
   * Suscribe un handler a un tipo de evento.
   * Múltiples handlers pueden suscribirse al mismo tipo; se ejecutan en paralelo.
   *
   * @param type    - Tipo de evento al que se quiere suscribir.
   * @param handler - Función callback que se ejecutará cuando se publique el evento.
   */
  subscribe(type: EventType, handler: EventHandler): void {
    // Recupera la lista existente o crea un array vacío, y agrega el nuevo handler
    const existing = this.handlers.get(type) ?? [];
    this.handlers.set(type, [...existing, handler]);
  }

  /**
   * Publica un evento y ejecuta todos los handlers suscritos en paralelo.
   * Si un handler falla, el error se registra en el log pero NO interrumpe
   * la ejecución del resto de handlers ni del flujo principal del llamador.
   *
   * @param event - Evento de dominio que se va a publicar.
   */
  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];

    // Salida temprana si nadie escucha este tipo de evento
    if (handlers.length === 0) return;

    // Ejecuta todos los handlers de forma concurrente; aísla errores individuales
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (err) {
          // Un handler fallido no debe detener al resto: solo se loguea el error
          logger.error({ err, eventType: event.type, aggregateId: event.aggregateId },
            'EventBus handler failed');
        }
      }),
    );
  }

  /**
   * Lista los tipos de eventos que tienen al menos un suscriptor registrado.
   * Útil para diagnóstico y tests.
   *
   * @returns Array de {@link EventType} con suscriptores activos.
   */
  subscribedTypes(): EventType[] {
    return [...this.handlers.keys()];
  }
}

/** Instancia singleton del bus de eventos. Compartida por toda la aplicación. */
export const eventBus = new EventBus();
