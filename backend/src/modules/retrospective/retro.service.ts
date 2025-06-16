/**
 * @file retro.service.ts
 * @module retrospective
 * @description Servicio de lógica de negocio para retrospectivas.
 *
 * Centraliza todas las operaciones sobre retrospectivas, tarjetas y acciones:
 * - Sanitización y limitación de longitud de textos antes de persistirlos.
 * - Publicación de eventos PubSub tras cada mutación para sincronización
 *   en tiempo real entre los participantes de la sesión.
 * - Carga de datos relacionados (autor de tarjeta, responsable de acción).
 *
 * El método privado `retroWithDetails` es el punto único de carga de una
 * retrospectiva con todas sus relaciones, evitando duplicación de queries.
 * El método privado `publishUpdate` combina la recarga y la publicación.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../utils/error.utils';
import { pubsub, RETRO_UPDATED_CHANNEL } from '../../realtime/pubsub';
import { sanitizeString, limitLength } from '../../utils/sanitize.utils';

/**
 * @class RetroService
 * @description Orquesta el ciclo de vida completo de una retrospectiva Scrum.
 */
export class RetroService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Carga una retrospectiva completa con todas sus relaciones anidadas.
   * Las tarjetas se ordenan por votos descendente (las más votadas primero).
   * Las acciones se ordenan por fecha de creación ascendente.
   *
   * @param id - ID de la retrospectiva.
   * @returns La retrospectiva con tarjetas y acciones incluidas.
   * @throws NotFoundError si la retrospectiva no existe.
   */
  private async retroWithDetails(id: string) {
    const retro = await this.db.retrospective.findUnique({
      where: { id },
      include: {
        // Tarjetas ordenadas por popularidad (votos desc) para priorizar discusión
        cards: { orderBy: { votes: 'desc' }, include: { author: true } },
        // Acciones ordenadas cronológicamente para seguimiento progresivo
        actions: { orderBy: { createdAt: 'asc' }, include: { assignedTo: true } },
      },
    });
    if (!retro) throw new NotFoundError('Retrospective');
    return retro;
  }

  /**
   * Recarga la retrospectiva completa y publica el evento de actualización
   * por PubSub para que todos los clientes suscritos reciban el estado actual.
   * Los errores de publicación se silencian para no bloquear la operación.
   *
   * @param retroId - ID de la retrospectiva a recargar y publicar.
   * @returns La retrospectiva actualizada con todos sus detalles.
   */
  private async publishUpdate(retroId: string) {
    const retro = await this.retroWithDetails(retroId);
    // El error de publicación no debe interrumpir la respuesta al cliente
    await pubsub.publish(RETRO_UPDATED_CHANNEL(retroId), { retroUpdated: retro }).catch(() => {});
    return retro;
  }

  /**
   * Retorna todas las retrospectivas de un proyecto, incluyendo tarjetas
   * y acciones, ordenadas de más reciente a más antigua.
   *
   * @param projectId - ID del proyecto.
   * @returns Lista de retrospectivas con datos completos.
   */
  async getAll(projectId: string) {
    return this.db.retrospective.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        cards: { orderBy: { votes: 'desc' }, include: { author: true } },
        actions: { orderBy: { createdAt: 'asc' }, include: { assignedTo: true } },
      },
    });
  }

  /**
   * Retorna una retrospectiva específica por ID con todos sus detalles.
   *
   * @param id - ID de la retrospectiva.
   * @returns La retrospectiva con tarjetas y acciones.
   */
  async getOne(id: string) {
    return this.retroWithDetails(id);
  }

  /**
   * Crea una nueva sesión de retrospectiva en estado OPEN.
   * El estado inicial `OPEN` indica que la sesión está activa y acepta
   * nuevas tarjetas y acciones.
   *
   * @param projectId - ID del proyecto.
   * @param title - Título de la sesión.
   * @param template - Plantilla de formato (p.ej. START_STOP_CONTINUE).
   * @param sprintId - Sprint asociado (puede ser undefined).
   * @param createdById - ID del usuario que crea la sesión.
   * @returns La retrospectiva recién creada con listas vacías.
   */
  async create(projectId: string, title: string, template: string, sprintId: string | undefined, createdById: string) {
    return this.db.retrospective.create({
      data: { projectId, title, template: template ?? 'START_STOP_CONTINUE', sprintId, createdById, status: 'OPEN' },
      include: { cards: true, actions: true },
    });
  }

  /**
   * Agrega una tarjeta a la retrospectiva y publica el estado actualizado.
   * El texto de la tarjeta es sanitizado (elimina HTML) y limitado a 2000 caracteres
   * antes de persistirlo para prevenir XSS y desbordamiento de datos.
   *
   * @param retroId - ID de la retrospectiva.
   * @param column - Columna destino (p.ej. "START", "STOP", "CONTINUE").
   * @param body - Texto de la tarjeta.
   * @param authorId - ID del usuario que agrega la tarjeta.
   * @returns La retrospectiva actualizada (para que el resolver extraiga la tarjeta).
   */
  async addCard(retroId: string, column: string, body: string, authorId: string) {
    // Sanitización: se eliminan etiquetas HTML y se limita la longitud
    const cleanBody = limitLength(sanitizeString(body), 2000);
    await this.db.retroCard.create({ data: { retroId, column, body: cleanBody, authorId } });
    return this.publishUpdate(retroId);
  }

  /**
   * Elimina una tarjeta de la retrospectiva y publica el estado actualizado.
   * Primero verifica que la tarjeta exista para obtener su `retroId` y poder
   * publicar la actualización en el canal correcto.
   *
   * @param id - ID de la tarjeta a eliminar.
   * @returns `true` siempre que la eliminación sea exitosa.
   * @throws NotFoundError si la tarjeta no existe.
   */
  async deleteCard(id: string) {
    const card = await this.db.retroCard.findUnique({ where: { id } });
    if (!card) throw new NotFoundError('RetroCard');
    await this.db.retroCard.delete({ where: { id } });
    // Se publica el estado actualizado sin la tarjeta eliminada
    await this.publishUpdate(card.retroId);
    return true;
  }

  /**
   * Incrementa en 1 el contador de votos de una tarjeta.
   * Permite que los participantes voten las tarjetas más importantes
   * para priorizar la discusión. Publica el estado actualizado.
   *
   * @param id - ID de la tarjeta a votar.
   * @returns La tarjeta con el contador de votos incrementado.
   */
  async voteCard(id: string) {
    // Se usa increment atómico para evitar race conditions en votación concurrente
    const card = await this.db.retroCard.update({ where: { id }, data: { votes: { increment: 1 } }, include: { author: true } });
    await this.publishUpdate(card.retroId);
    return card;
  }

  /**
   * Agrega una acción de mejora a la retrospectiva.
   * El título es sanitizado y limitado a 500 caracteres. La fecha límite
   * se convierte de string ISO a objeto Date si está presente.
   *
   * @param retroId - ID de la retrospectiva.
   * @param title - Descripción de la acción de mejora.
   * @param assignedToId - ID del responsable (opcional).
   * @param dueDate - Fecha límite en formato ISO string (opcional).
   * @returns La retrospectiva actualizada (para que el resolver extraiga la acción).
   */
  async addAction(retroId: string, title: string, assignedToId?: string, dueDate?: string) {
    const cleanTitle = limitLength(sanitizeString(title), 500);
    await this.db.retroAction.create({
      data: {
        retroId,
        title: cleanTitle,
        assignedToId,
        // Se convierte el string ISO a Date solo si está presente
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
    });
    return this.publishUpdate(retroId);
  }

  /**
   * Alterna el estado `done` de una acción de mejora.
   * Si la acción estaba pendiente (`done: false`) pasa a completada (`done: true`)
   * y viceversa. Publica el estado actualizado.
   *
   * @param id - ID de la acción a alternar.
   * @returns La acción con el estado `done` invertido.
   * @throws NotFoundError si la acción no existe.
   */
  async toggleAction(id: string) {
    const action = await this.db.retroAction.findUnique({ where: { id } });
    if (!action) throw new NotFoundError('RetroAction');
    // Se invierte el valor actual de `done` con NOT booleano
    const updated = await this.db.retroAction.update({ where: { id }, data: { done: !action.done }, include: { assignedTo: true } });
    await this.publishUpdate(action.retroId);
    return updated;
  }

  /**
   * Cierra la retrospectiva cambiando su estado a `CLOSED`.
   * Una sesión cerrada no acepta nuevas tarjetas ni acciones.
   *
   * @param id - ID de la retrospectiva a cerrar.
   * @returns La retrospectiva con estado CLOSED y todos sus detalles.
   */
  async close(id: string) {
    await this.db.retrospective.update({ where: { id }, data: { status: 'CLOSED' } });
    // Se recarga con todos los detalles para retornar el estado final completo
    return this.retroWithDetails(id);
  }
}
