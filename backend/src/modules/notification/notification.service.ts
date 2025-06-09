/**
 * @file notification.service.ts
 * @module notification
 * @description Servicio de lógica de negocio para notificaciones.
 *
 * Aplica reglas de autorización (verificar que la notificación
 * pertenece al usuario solicitante) antes de delegar al repositorio.
 * También serializa el payload a JSON al crear notificaciones.
 */

import { Notification } from '@prisma/client';
import { NotificationRepository } from './notification.repository';
import { NotFoundError, ForbiddenError } from '../../utils/error.utils';

/**
 * @class NotificationService
 * @description Orquesta las operaciones sobre notificaciones con validaciones
 * de existencia y control de acceso.
 */
export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  /**
   * Retorna las notificaciones de un usuario con el límite especificado.
   *
   * @param userId - ID del usuario destinatario.
   * @param limit - Número máximo de notificaciones a retornar (por defecto 30).
   * @returns Lista de notificaciones del usuario.
   */
  async getNotifications(userId: string, limit = 30): Promise<Notification[]> {
    return this.repo.findByUser(userId, limit);
  }

  /**
   * Retorna el número de notificaciones no leídas del usuario.
   *
   * @param userId - ID del usuario.
   * @returns Conteo de notificaciones con `readAt` nulo.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.countUnread(userId);
  }

  /**
   * Marca una notificación como leída tras verificar existencia y propiedad.
   *
   * @param userId - ID del usuario que realiza la acción.
   * @param id - ID de la notificación a marcar.
   * @returns La notificación actualizada.
   * @throws NotFoundError si la notificación no existe.
   * @throws ForbiddenError si la notificación no pertenece al usuario.
   */
  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.repo.findById(id);

    // Se verifica que la notificación exista antes de comprobar propiedad
    if (!notification) throw new NotFoundError('Notificación');

    // Un usuario solo puede marcar como leídas sus propias notificaciones
    if (notification.userId !== userId) throw new ForbiddenError();

    return this.repo.markRead(id);
  }

  /**
   * Marca como leídas todas las notificaciones del usuario.
   *
   * @param userId - ID del usuario.
   * @returns `true` siempre que la operación sea exitosa.
   */
  async markAllRead(userId: string): Promise<boolean> {
    await this.repo.markAllRead(userId);
    return true;
  }

  /**
   * Crea una nueva notificación para un usuario.
   * El payload (datos adicionales para construir el mensaje en el cliente)
   * se serializa a JSON string antes de persistirlo, ya que el campo
   * en la base de datos es de tipo `String`.
   *
   * @param userId - ID del usuario destinatario.
   * @param type - Tipo de notificación (p.ej. "STORY_ASSIGNED").
   * @param payload - Objeto con datos contextuales de la notificación (opcional).
   * @returns La notificación creada.
   */
  async createNotification(
    userId: string,
    type: string,
    payload?: Record<string, unknown>,
  ): Promise<Notification> {
    return this.repo.create({
      userId,
      type,
      // El payload se serializa a string JSON para almacenamiento; undefined si no hay datos
      payload: payload ? JSON.stringify(payload) : undefined,
    });
  }
}
