/**
 * @file project.repository.ts
 * @description Capa de acceso a datos para proyectos.
 *
 * El repositorio encapsula todas las consultas a Prisma relacionadas con la
 * entidad `Project`. El servicio nunca llama a Prisma directamente, lo que
 * facilita la sustitución por mocks en tests unitarios.
 *
 * Un proyecto pertenece a un equipo (`teamId`) y tiene una clave única (`key`)
 * dentro de ese equipo, usada como prefijo en identificadores de historias (p. ej. `PRJ-42`).
 */
import { PrismaClient, Project } from '@prisma/client';

/**
 * Repositorio de proyectos.
 * Cada método traduce una operación de negocio a una consulta Prisma concreta.
 */
export class ProjectRepository {
  /**
   * @param db - Cliente Prisma inyectado desde el contexto de la petición.
   */
  constructor(private readonly db: PrismaClient) {}

  /**
   * Busca un proyecto por su ID primario.
   * Devuelve `null` si no existe para que el servicio decida cómo manejar el caso.
   *
   * @param id - ID del proyecto.
   */
  async findById(id: string): Promise<Project | null> {
    return this.db.project.findUnique({ where: { id } });
  }

  /**
   * Devuelve todos los proyectos pertenecientes a un equipo.
   *
   * @param teamId - ID del equipo propietario de los proyectos.
   */
  async findByTeam(teamId: string): Promise<Project[]> {
    return this.db.project.findMany({ where: { teamId } });
  }

  /**
   * Crea un nuevo proyecto en la base de datos.
   *
   * @param data - Nombre, clave única (ya normalizada a mayúsculas) e ID del equipo.
   */
  async create(data: { name: string; key: string; teamId: string }): Promise<Project> {
    return this.db.project.create({ data });
  }

  /**
   * Actualiza campos editables de un proyecto existente.
   * `settings` es un JSON serializado que almacena configuración flexible del proyecto.
   *
   * @param id   - ID del proyecto a actualizar.
   * @param data - Campos opcionales a modificar.
   */
  async update(id: string, data: { name?: string; settings?: string }): Promise<Project> {
    return this.db.project.update({ where: { id }, data });
  }

  /**
   * Elimina un proyecto permanentemente.
   * Prisma aplica `onDelete: Cascade` en las entidades relacionadas
   * (épicas, historias de usuario, sprints), que se eliminan automáticamente.
   *
   * @param id - ID del proyecto a eliminar.
   */
  async delete(id: string): Promise<void> {
    await this.db.project.delete({ where: { id } });
  }
}
