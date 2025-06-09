/**
 * @file event-store.ts
 * @description Almacén de eventos de dominio (Event Sourcing ligero). Persiste cada
 * evento en la tabla `Event` de la base de datos de forma inmutable, lo que permite
 * reconstruir el historial de cualquier agregado y auditar cambios en el tiempo.
 *
 * El EventStore se complementa con {@link EventBus}: el store garantiza durabilidad
 * mientras que el bus gestiona las reacciones en tiempo real.
 */

import { PrismaClient } from '@prisma/client';
import { EventType, AggregateType } from './event-types';

/**
 * Representación en memoria de un evento de dominio.
 * Los campos `id` y `createdAt` son opcionales al crear un evento nuevo
 * (la base de datos los genera automáticamente).
 */
export interface DomainEvent {
  /** Identificador único del evento (UUID generado por la BD). */
  id?: string;
  /** Tipo semántico del evento, definido en {@link EventType}. */
  type: EventType;
  /** ID del agregado sobre el que ocurrió el evento (sprint, story, etc.). */
  aggregateId: string;
  /** Tipo del agregado dueño del evento. */
  aggregateType: AggregateType;
  /** Datos adicionales específicos del evento. Se serializa como JSON en la BD. */
  payload: Record<string, unknown>;
  /** ID del usuario que desencadenó el evento, si aplica. */
  userId?: string;
  /** Marca de tiempo de creación (asignada por la BD). */
  createdAt?: Date;
}

/**
 * EventStore — persiste eventos de dominio inmutables en la tabla `Event`.
 * Permite reconstruir el historial de cambios de cualquier agregado.
 */
export class EventStore {
  /**
   * @param db - Cliente de Prisma para acceder a la tabla `Event`.
   */
  constructor(private readonly db: PrismaClient) {}

  /**
   * Persiste un nuevo evento de dominio en la base de datos.
   * El payload se serializa a JSON antes de almacenarse.
   *
   * @param event - Evento de dominio a guardar.
   */
  async append(event: DomainEvent): Promise<void> {
    await this.db.event.create({
      data: {
        type: event.type,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        // El payload se guarda como string JSON para compatibilidad con el campo `Json` de Prisma
        payload: JSON.stringify(event.payload),
      },
    });
  }

  /**
   * Devuelve todos los eventos asociados a un agregado concreto,
   * ordenados cronológicamente de más antiguo a más reciente.
   * Útil para reconstruir el estado actual de un agregado reproduciendo
   * sus eventos (event replay).
   *
   * @param aggregateId - ID del agregado cuyos eventos se quieren obtener.
   * @returns Array de {@link DomainEvent} en orden cronológico ascendente.
   */
  async getByAggregate(aggregateId: string): Promise<DomainEvent[]> {
    const rows = await this.db.event.findMany({
      where: { aggregateId },
      orderBy: { createdAt: 'asc' },
    });

    // Transforma cada fila de BD en un DomainEvent, deserializando el payload
    return rows.map((row) => ({
      id: row.id,
      type: row.type as EventType,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType as AggregateType,
      payload: JSON.parse(row.payload as string) as Record<string, unknown>,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Devuelve los últimos N eventos de un tipo dado, ordenados del más reciente
   * al más antiguo. Útil para dashboards de actividad y auditoría por tipo.
   *
   * @param type  - Tipo de evento a consultar.
   * @param limit - Número máximo de eventos a devolver (por defecto 50).
   * @returns Array de {@link DomainEvent} en orden cronológico descendente.
   */
  async getByType(type: EventType, limit = 50): Promise<DomainEvent[]> {
    const rows = await this.db.event.findMany({
      where: { type },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Misma transformación que en getByAggregate: deserializa payload de JSON
    return rows.map((row) => ({
      id: row.id,
      type: row.type as EventType,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType as AggregateType,
      payload: JSON.parse(row.payload as string) as Record<string, unknown>,
      createdAt: row.createdAt,
    }));
  }
}
