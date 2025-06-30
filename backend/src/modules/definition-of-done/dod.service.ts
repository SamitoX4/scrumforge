/**
 * @file dod.service.ts
 * @module definition-of-done
 * @description Servicio de lógica de negocio para los ítems de Definition of Done.
 *
 * Gestiona el ciclo de vida de los criterios de completitud de un proyecto:
 * creación con orden automático, actualización parcial, eliminación
 * y reordenamiento masivo en paralelo.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../utils/error.utils';

/**
 * @class DodService
 * @description Encapsula la lógica de negocio para la entidad `DodItem`.
 * Utiliza Prisma directamente (sin repositorio intermedio) dado el bajo
 * nivel de complejidad de las operaciones.
 */
export class DodService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Recupera todos los ítems DoD de un proyecto ordenados por su campo `order`
   * de menor a mayor, respetando el orden visual que el equipo ha configurado.
   *
   * @param projectId - ID del proyecto.
   * @returns Lista de ítems DoD ordenados ascendentemente.
   */
  async getItems(projectId: string) {
    return this.db.dodItem.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Crea un nuevo ítem DoD al final de la lista existente.
   * Para calcular el orden, se consulta el ítem con el mayor `order`
   * del proyecto y se le suma 1. Si no hay ítems previos, empieza en 0.
   *
   * @param projectId - ID del proyecto al que pertenece el ítem.
   * @param text - Texto descriptivo del criterio de completitud.
   * @returns El ítem DoD recién creado con su orden asignado.
   */
  async create(projectId: string, text: string) {
    // Se busca el último ítem para calcular el siguiente número de orden
    const last = await this.db.dodItem.findFirst({ where: { projectId }, orderBy: { order: 'desc' } });

    // Si no hay ítems previos, `last` es null y se usa -1 para obtener orden 0
    return this.db.dodItem.create({ data: { projectId, text, order: (last?.order ?? -1) + 1 } });
  }

  /**
   * Actualiza el texto de un ítem DoD existente.
   * La actualización es parcial: si `text` es undefined no se modifica.
   * Verifica existencia antes de intentar la actualización.
   *
   * @param id - ID del ítem a actualizar.
   * @param text - Nuevo texto del criterio (opcional).
   * @returns El ítem DoD actualizado.
   * @throws NotFoundError si el ítem no existe.
   */
  async update(id: string, text?: string) {
    const item = await this.db.dodItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('DodItem');

    // Solo se incluye `text` en el payload si fue proporcionado
    return this.db.dodItem.update({ where: { id }, data: { ...(text !== undefined ? { text } : {}) } });
  }

  /**
   * Elimina un ítem DoD por su ID.
   * No reajusta los números de orden de los ítems restantes;
   * eso es responsabilidad del cliente al llamar `reorderDodItems` si lo necesita.
   *
   * @param id - ID del ítem a eliminar.
   * @returns `true` siempre que la eliminación sea exitosa.
   */
  async delete(id: string): Promise<boolean> {
    await this.db.dodItem.delete({ where: { id } });
    return true;
  }

  /**
   * Reordena todos los ítems DoD de un proyecto según el array recibido.
   * El índice de cada ID en `orderedIds` se usa como nuevo valor de `order`.
   *
   * Las actualizaciones se ejecutan en paralelo con `Promise.all` para
   * minimizar la latencia, ya que son independientes entre sí.
   * Tras el reordenamiento se retorna la lista actualizada.
   *
   * @param projectId - ID del proyecto cuyos ítems se reordenan.
   * @param orderedIds - Array de IDs en el orden deseado.
   * @returns Lista de ítems DoD con el nuevo orden persistido.
   */
  async reorder(projectId: string, orderedIds: string[]) {
    // Cada ítem se actualiza con el índice de su posición en el array
    await Promise.all(
      orderedIds.map((id, order) => this.db.dodItem.update({ where: { id }, data: { order } })),
    );
    // Se retorna la lista fresca para confirmar el estado persistido
    return this.getItems(projectId);
  }
}
