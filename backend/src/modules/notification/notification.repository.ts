/**
 * @file notification.repository.ts
 * @module notification
 * @description Repositorio de acceso a datos para la entidad `Notification`.
 *
 * Centraliza todas las operaciones sobre la tabla `notification` de Prisma.
 * Las notificaciones son mensajes internos generados automáticamente por el
 * sistema (asignaciones, cambios de estado, menciones, etc.) y se marcan
 * como leídas por el usuario destinatario.
 */

import { Notification, PrismaClient } from '@prisma/client';

/**
 * @class NotificationRepository
 * @description Provee operaciones CRUD y de consulta para notificaciones.
 * Recibe el cliente Prisma por inyección para facilitar pruebas unitarias.
 */
export class NotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Recupera las notificaciones de un usuario ordenadas de más reciente
   * a más antigua. Se aplica un límite para evitar cargar demasiados
   * registros en cada request.
   *
   * @param userId - ID del usuario destinatario.
   * @param limit - Número máximo de notificaciones (por defecto 30).
   * @returns Lista de notificaciones del usuario.
   */
  async findByUser(userId: string, limit = 30): Promise<Notification[]> {
    return this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }, // Las más recientes primero para el panel de notificaciones
      take: limit,
    });
  }

  /**
   * Busca una notificación por su ID único.
   * Utilizado antes de marcar una notificación como leída para
   * verificar existencia y propiedad.
   *
   * @param id - ID de la notificación.
   * @returns La notificación encontrada o null.
   */
  async findById(id: string): Promise<Notification | null> {
    return this.db.notification.findUnique({ where: { id } });
  }

  /**
   * Cuenta las notificaciones no leídas de un usuario.
   * Una notificación no leída tiene `readAt` igual a null.
   * Este conteo se muestra como badge en la UI.
   *
   * @param userId - ID del usuario.
   * @returns Número de notificaciones sin leer.
   */
  async countUnread(userId: string): Promise<number> {
    // Se filtra por readAt: null para contar solo las no leídas
    return this.db.notification.count({ where: { userId, readAt: null } });
  }

  /**
   * Marca una notificación individual como leída estableciendo la
   * fecha actual en el campo `readAt`.
   *
   * @param id - ID de la notificación a marcar.
   * @returns La notificación actualizada con `readAt` asignado.
   */
  async markRead(id: string): Promise<Notification> {
    return this.db.notification.update({
      where: { id },
      data: { readAt: new Date() }, // Se registra el momento exacto de lectura
    });
  }

  /**
   * Marca como leídas todas las notificaciones sin leer de un usuario.
   * Útil para el botón "marcar todas como leídas" del panel de notificaciones.
   *
   * @param userId - ID del usuario cuyas notificaciones se marcan.
   */
  async markAllRead(userId: string): Promise<void> {
    await this.db.notification.updateMany({
      where: { userId, readAt: null }, // Solo se actualizan las que aún no han sido leídas
      data: { readAt: new Date() },
    });
  }

  /**
   * Crea una nueva notificación para un usuario.
   * El campo `payload` almacena datos adicionales en formato JSON (serializado
   * como string) para que el cliente pueda construir el mensaje dinámicamente.
   *
   * @param data - Datos de la notificación.
   * @param data.userId - ID del usuario destinatario.
   * @param data.type - Tipo de notificación (p.ej. "STORY_ASSIGNED", "SPRINT_STARTED").
   * @param data.payload - Datos adicionales serializados en JSON (opcional).
   * @returns La notificación recién creada.
   */
  async create(data: {
    userId: string;
    type: string;
    payload?: string;
  }): Promise<Notification> {
    return this.db.notification.create({ data });
  }
}
