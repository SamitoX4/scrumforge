/**
 * @file epic.repository.ts
 * @description Capa de acceso a datos para épicas.
 *
 * El repositorio encapsula todas las consultas a Prisma relacionadas con la
 * entidad `Epic`. El servicio nunca llama a Prisma directamente, lo que
 * facilita la sustitución por mocks en tests unitarios.
 *
 * El campo `order` controla la posición de la épica en la lista del backlog.
 * Al crear, se asigna automáticamente el siguiente entero disponible (last + 1).
 * Al reordenar, el servicio actualiza `order` en lote usando `Promise.all`.
 */
import { Epic, PrismaClient } from '@prisma/client';

/**
 * Repositorio de épicas.
 * Cada método traduce una operación de negocio a una consulta Prisma concreta.
 */
export class EpicRepository {
  /**
   * @param db - Cliente Prisma inyectado desde el contexto de la petición.
   */
  constructor(private readonly db: PrismaClient) {}

  /**
   * Busca una épica por su ID primario.
   * Devuelve `null` si no existe para que el servicio decida cómo manejar el caso.
   *
   * @param id - ID de la épica.
   */
  async findById(id: string): Promise<Epic | null> {
    return this.db.epic.findUnique({ where: { id } });
  }

  /**
   * Devuelve todas las épicas de un proyecto, ordenadas por `order` ascendente.
   * El orden refleja la secuencia definida por el Product Owner en el backlog.
   *
   * @param projectId - ID del proyecto.
   */
  async findByProject(projectId: string): Promise<Epic[]> {
    return this.db.epic.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Crea una nueva épica al final de la lista del proyecto.
   * El campo `order` se calcula como el máximo existente más uno,
   * garantizando que la nueva épica siempre aparezca al final.
   *
   * @param data - Título, descripción opcional, proyecto, prioridad y color.
   */
  async create(data: {
    title: string;
    description?: string;
    projectId: string;
    priority?: string;
    color?: string;
  }): Promise<Epic> {
    // Obtener el mayor `order` actual para colocar la nueva épica al final
    const last = await this.db.epic.findFirst({
      where: { projectId: data.projectId },
      orderBy: { order: 'desc' },
    });
    // Si no hay épicas previas, empezar desde 0; en caso contrario, siguiente entero
    return this.db.epic.create({
      data: { ...data, order: (last?.order ?? -1) + 1 },
    });
  }

  /**
   * Actualiza campos editables de una épica.
   * Todos los campos son opcionales para permitir actualizaciones parciales.
   * El campo `order` se actualiza aquí durante las operaciones de reordenamiento.
   *
   * @param id   - ID de la épica a actualizar.
   * @param data - Campos opcionales a modificar.
   */
  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      priority?: string;
      color?: string;
      order?: number;
    },
  ): Promise<Epic> {
    return this.db.epic.update({ where: { id }, data });
  }

  /**
   * Elimina una épica permanentemente.
   * Las historias de usuario sin épica destino quedan con `epicId = null`
   * gracias a la configuración `onDelete: SetNull` en el esquema de Prisma.
   *
   * @param id - ID de la épica a eliminar.
   */
  async delete(id: string): Promise<void> {
    await this.db.epic.delete({ where: { id } });
  }
}
