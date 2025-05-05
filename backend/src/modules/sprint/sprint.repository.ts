import { PrismaClient, Sprint } from '@prisma/client';

/**
 * Repositorio de acceso a datos para la entidad Sprint.
 *
 * Encapsula todas las operaciones de base de datos relacionadas con sprints,
 * permitiendo que el servicio no dependa directamente de Prisma y facilitando
 * las pruebas unitarias mediante inyección de dependencias.
 */
export class SprintRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Busca un sprint por su identificador único.
   * Devuelve null si no existe, en lugar de lanzar un error, para que
   * la capa de servicio decida cómo manejar la ausencia.
   *
   * @param id - ID del sprint a buscar
   * @returns El sprint encontrado o null
   */
  async findById(id: string): Promise<Sprint | null> {
    return this.db.sprint.findUnique({ where: { id } });
  }

  /**
   * Obtiene todos los sprints de un proyecto, ordenados del más reciente
   * al más antiguo para mostrar primero los sprints actuales en la UI.
   *
   * @param projectId - ID del proyecto propietario
   * @returns Lista de sprints del proyecto
   */
  async findByProject(projectId: string): Promise<Sprint[]> {
    return this.db.sprint.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca el sprint activo de un proyecto.
   * Solo puede existir un sprint activo a la vez por proyecto; esta restricción
   * se verifica en el servicio antes de iniciar uno nuevo.
   *
   * @param projectId - ID del proyecto
   * @returns El sprint activo o null si no existe ninguno
   */
  async findActive(projectId: string): Promise<Sprint | null> {
    return this.db.sprint.findFirst({
      where: { projectId, status: 'ACTIVE' },
    });
  }

  /**
   * Crea un nuevo sprint en estado PLANNING (estado por defecto de Prisma).
   * Las fechas son opcionales porque el sprint puede planificarse antes de
   * definir el período exacto.
   *
   * @param data - Datos del sprint a crear
   * @returns El sprint creado con su ID generado
   */
  async create(data: {
    name: string;
    goal?: string;
    projectId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Sprint> {
    return this.db.sprint.create({ data });
  }

  /**
   * Actualiza campos específicos de un sprint.
   * Se usa tanto para cambios de metadatos (nombre, goal) como para
   * transiciones de estado (PLANNING → ACTIVE → COMPLETED).
   *
   * @param id   - ID del sprint a actualizar
   * @param data - Campos a modificar (solo los incluidos se actualizan)
   * @returns El sprint con los datos actualizados
   */
  async update(
    id: string,
    data: {
      name?: string;
      goal?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
      plannedPoints?: number;
    },
  ): Promise<Sprint> {
    return this.db.sprint.update({ where: { id }, data });
  }

  /**
   * Elimina permanentemente un sprint de la base de datos.
   * Antes de llamar a este método, el servicio debe haber movido las
   * historias de usuario asociadas al backlog para no perder trabajo.
   *
   * @param id - ID del sprint a eliminar
   */
  async delete(id: string): Promise<void> {
    await this.db.sprint.delete({ where: { id } });
  }
}
