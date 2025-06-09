import { eventBus } from '../event-bus';
import { EventType } from '../event-types';
import type { DomainEvent } from '../event-store';
import { logger } from '../../utils/logger';

/**
 * Sprint event handlers — reaccionan a cambios de ciclo de vida de sprints.
 * Se registran al arrancar la app llamando a `registerSprintHandlers()`.
 */
export function registerSprintHandlers(): void {
  eventBus.subscribe(EventType.SPRINT_STARTED, handleSprintStarted);
  eventBus.subscribe(EventType.SPRINT_COMPLETED, handleSprintCompleted);
  eventBus.subscribe(EventType.SPRINT_DELETED, handleSprintDeleted);
}

async function handleSprintStarted(event: DomainEvent): Promise<void> {
  logger.info(
    { sprintId: event.aggregateId, payload: event.payload },
    'Sprint iniciado — procesando evento',
  );
  // Extensión futura: sincronizar con integraciones externas, enviar notificaciones, etc.
}

async function handleSprintCompleted(event: DomainEvent): Promise<void> {
  const { sprintName, completedPoints, totalPoints } = event.payload as {
    sprintName?: string;
    completedPoints?: number;
    totalPoints?: number;
  };

  logger.info(
    {
      sprintId: event.aggregateId,
      sprintName,
      completedPoints,
      totalPoints,
    },
    'Sprint completado — procesando evento',
  );
  // Extensión futura: generar reporte automático, calcular velocidad, etc.
}

async function handleSprintDeleted(event: DomainEvent): Promise<void> {
  logger.info(
    { sprintId: event.aggregateId },
    'Sprint eliminado — procesando evento',
  );
}
