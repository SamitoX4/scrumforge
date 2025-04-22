/**
 * @file epic.service.ts
 * @description Lógica de negocio para la gestión de épicas.
 *
 * Responsabilidades:
 * - Consultar épicas por ID o por proyecto.
 * - Crear épicas verificando permisos del usuario en el proyecto.
 * - Actualizar campos de épicas existentes.
 * - Eliminar épicas con opción de reasignar historias de usuario a otra épica.
 * - Reordenar épicas actualizando su campo `order` en paralelo.
 *
 * Solo los miembros con rol PRODUCT_OWNER o SCRUM_MASTER pueden crear, modificar
 * o eliminar épicas. Los DEVELOPER y STAKEHOLDER tienen acceso de solo lectura.
 */
import { Epic, PrismaClient } from '@prisma/client';
import { EpicRepository } from './epic.repository';
import { ForbiddenError, NotFoundError } from '../../utils/error.utils';

/**
 * Servicio de épicas de ScrumForge.
 * Centraliza las reglas de negocio sobre CRUD y reordenamiento de épicas,
 * delegando el acceso a datos en `EpicRepository`.
 */
export class EpicService {
  /**
   * @param repo - Repositorio de épicas para operaciones CRUD básicas.
   * @param db   - Cliente Prisma para verificación de permisos y reasignación de historias.
   */
  constructor(
    private readonly repo: EpicRepository,
    private readonly db: PrismaClient,
  ) {}

  /**
   * Devuelve todas las épicas de un proyecto, ordenadas por `order` ascendente.
   *
   * @param projectId - ID del proyecto.
   */
  async getEpics(projectId: string): Promise<Epic[]> {
    return this.repo.findByProject(projectId);
  }

  /**
   * Devuelve una épica por su ID.
   *
   * @param id - ID de la épica.
   * @throws {NotFoundError} Si la épica no existe.
   */
  async getEpic(id: string): Promise<Epic> {
    const epic = await this.repo.findById(id);
    if (!epic) throw new NotFoundError('Épica');
    return epic;
  }

  /**
   * Crea una nueva épica en el proyecto indicado.
   * Verifica que el usuario tiene permisos de escritura sobre el proyecto.
   * La épica se añade al final de la lista (mayor `order` + 1).
   *
   * @param userId - ID del usuario que crea la épica.
   * @param input  - Datos de la nueva épica.
   * @throws {ForbiddenError} Si el usuario no tiene permisos de escritura en el proyecto.
   */
  async createEpic(
    userId: string,
    input: {
      title: string;
      description?: string;
      projectId: string;
      priority?: string;
      color?: string;
    },
  ): Promise<Epic> {
    // Verificar permisos antes de cualquier operación de escritura
    await this.checkCanWrite(userId, input.projectId);
    return this.repo.create(input);
  }

  /**
   * Actualiza los datos de una épica existente.
   * Verifica que el usuario tiene permisos de escritura sobre el proyecto de la épica.
   *
   * @param userId - ID del usuario que realiza la actualización.
   * @param id     - ID de la épica a actualizar.
   * @param data   - Campos opcionales a modificar.
   * @throws {NotFoundError}  Si la épica no existe.
   * @throws {ForbiddenError} Si el usuario no tiene permisos de escritura.
   */
  async updateEpic(
    userId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      priority?: string;
      color?: string;
      order?: number;
    },
  ): Promise<Epic> {
    const epic = await this.repo.findById(id);
    if (!epic) throw new NotFoundError('Épica');
    // Verificar permisos usando el projectId de la épica existente
    await this.checkCanWrite(userId, epic.projectId);
    return this.repo.update(id, data);
  }

  /**
   * Elimina una épica permanentemente.
   * Si se proporciona `targetEpicId`, las historias de usuario de la épica eliminada
   * se reasignan a la épica destino (debe pertenecer al mismo proyecto).
   * Sin `targetEpicId`, `onDelete: SetNull` en Prisma deja las historias sin épica.
   *
   * @param userId        - ID del usuario que solicita la eliminación.
   * @param id            - ID de la épica a eliminar.
   * @param targetEpicId  - Épica opcional a la que reasignar las historias huérfanas.
   * @throws {NotFoundError}  Si la épica o la épica destino no existen.
   * @throws {ForbiddenError} Si el usuario no tiene permisos de escritura.
   */
  async deleteEpic(userId: string, id: string, targetEpicId?: string): Promise<boolean> {
    const epic = await this.repo.findById(id);
    if (!epic) throw new NotFoundError('Épica');
    await this.checkCanWrite(userId, epic.projectId);

    if (targetEpicId) {
      // Validar que la épica destino pertenece al mismo proyecto para evitar contaminación de datos
      const target = await this.repo.findById(targetEpicId);
      if (!target || target.projectId !== epic.projectId) {
        throw new NotFoundError('Épica destino');
      }
      // Reasignar todas las historias antes de eliminar la épica
      await this.db.userStory.updateMany({
        where: { epicId: id },
        data: { epicId: targetEpicId },
      });
    }
    // Las historias sin `targetEpicId` quedan con epicId = null (onDelete: SetNull en el esquema)
    await this.repo.delete(id);
    return true;
  }

  /**
   * Reordena las épicas de un proyecto asignando el índice del array como nuevo `order`.
   * Las actualizaciones se realizan en paralelo con `Promise.all` para minimizar la latencia.
   *
   * @param userId     - ID del usuario que realiza el reordenamiento.
   * @param projectId  - ID del proyecto cuyas épicas se reordenan.
   * @param orderedIds - Array de IDs de épicas en el nuevo orden deseado.
   * @returns Lista actualizada de épicas en el nuevo orden.
   */
  async reorderEpics(userId: string, projectId: string, orderedIds: string[]): Promise<Epic[]> {
    await this.checkCanWrite(userId, projectId);
    // Actualizar todos los campos `order` en paralelo: el índice del array = nuevo order
    await Promise.all(orderedIds.map((id, order) => this.repo.update(id, { order })));
    // Devolver la lista actualizada para confirmar el nuevo orden al cliente
    return this.repo.findByProject(projectId);
  }

  /**
   * Verifica que el usuario es miembro del equipo del proyecto con un rol que permite
   * modificar el backlog (PRODUCT_OWNER o SCRUM_MASTER).
   *
   * @param userId    - ID del usuario a verificar.
   * @param projectId - ID del proyecto sobre el que se evalúan los permisos.
   * @throws {NotFoundError}  Si el proyecto no existe.
   * @throws {ForbiddenError} Si el usuario no es miembro del equipo o no tiene rol suficiente.
   */
  private async checkCanWrite(userId: string, projectId: string): Promise<void> {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Proyecto');

    const member = await this.db.teamMember.findUnique({
      // Clave compuesta única que identifica la membresía en el equipo del proyecto
      where: { userId_teamId: { userId, teamId: project.teamId } },
    });
    if (!member) throw new ForbiddenError('No eres miembro de este proyecto');

    // Solo PO y SM pueden gestionar épicas; DEVELOPER y STAKEHOLDER son de solo lectura
    if (!['PRODUCT_OWNER', 'SCRUM_MASTER'].includes(member.role)) {
      throw new ForbiddenError('Solo Product Owners y Scrum Masters pueden gestionar épicas');
    }
  }
}
