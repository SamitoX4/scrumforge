/**
 * @file project.service.ts
 * @description Lógica de negocio para la gestión de proyectos.
 *
 * Responsabilidades:
 * - Consultar proyectos por ID o por equipo.
 * - Crear proyectos verificando unicidad de clave dentro del equipo y permisos del usuario.
 * - Actualizar nombre y configuración de proyectos existentes.
 * - Eliminar proyectos con cascada hacia épicas, historias y sprints.
 *
 * Solo los miembros con rol PRODUCT_OWNER o SCRUM_MASTER pueden crear,
 * actualizar o eliminar proyectos. Los DEVELOPER y STAKEHOLDER tienen acceso
 * de solo lectura.
 */
import { Project } from '@prisma/client';
import { ProjectRepository } from './project.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/error.utils';
import { PrismaClient } from '@prisma/client';

/**
 * Servicio de proyectos de ScrumForge.
 * Centraliza las reglas de negocio sobre CRUD de proyectos,
 * delegando el acceso a datos en `ProjectRepository`.
 */
export class ProjectService {
  /**
   * @param repo - Repositorio de proyectos para operaciones CRUD básicas.
   * @param db   - Cliente Prisma para verificación de membresía y unicidad de clave.
   */
  constructor(
    private readonly repo: ProjectRepository,
    private readonly db: PrismaClient,
  ) {}

  /**
   * Devuelve un proyecto por su ID.
   *
   * @param id - ID del proyecto.
   * @throws {NotFoundError} Si el proyecto no existe.
   */
  async getProject(id: string): Promise<Project> {
    const project = await this.repo.findById(id);
    if (!project) throw new NotFoundError('Proyecto');
    return project;
  }

  /**
   * Devuelve todos los proyectos de un equipo.
   *
   * @param teamId - ID del equipo.
   */
  async getProjects(teamId: string): Promise<Project[]> {
    return this.repo.findByTeam(teamId);
  }

  /**
   * Crea un nuevo proyecto dentro de un equipo.
   *
   * Pasos:
   * 1. Verifica que el usuario tiene permisos de gestión en el equipo.
   * 2. Normaliza la clave a mayúsculas para consistencia.
   * 3. Verifica que la clave no esté ya en uso dentro del mismo equipo.
   * 4. Crea el proyecto.
   *
   * @param userId - ID del usuario que crea el proyecto.
   * @param input  - Nombre, clave y equipo del nuevo proyecto.
   * @throws {ForbiddenError}  Si el usuario no tiene rol suficiente.
   * @throws {ConflictError}   Si la clave ya existe en el equipo.
   */
  async createProject(
    userId: string,
    input: { name: string; key: string; teamId: string },
  ): Promise<Project> {
    // Verificar permisos antes de cualquier operación de escritura
    await this.checkCanManage(userId, input.teamId);

    // Normalizar a mayúsculas para evitar duplicados por diferencia de capitalización
    const key = input.key.toUpperCase();
    const existing = await this.db.project.findUnique({
      // La restricción única en BD usa la combinación (teamId, key)
      where: { teamId_key: { teamId: input.teamId, key } },
    });
    if (existing) throw new ConflictError(`La clave "${key}" ya existe en este equipo`);

    return this.repo.create({ ...input, key });
  }

  /**
   * Actualiza el nombre y/o la configuración JSON de un proyecto.
   *
   * @param userId - ID del usuario que realiza la actualización.
   * @param id     - ID del proyecto a actualizar.
   * @param data   - Campos opcionales a modificar.
   * @throws {NotFoundError}  Si el proyecto no existe.
   * @throws {ForbiddenError} Si el usuario no tiene rol suficiente.
   */
  async updateProject(
    userId: string,
    id: string,
    data: { name?: string; settings?: string },
  ): Promise<Project> {
    const project = await this.repo.findById(id);
    if (!project) throw new NotFoundError('Proyecto');
    // Verificar permisos usando el teamId del proyecto existente
    await this.checkCanManage(userId, project.teamId);
    return this.repo.update(id, data);
  }

  /**
   * Elimina permanentemente un proyecto y todos sus datos en cascada.
   *
   * @param userId - ID del usuario que solicita la eliminación.
   * @param id     - ID del proyecto a eliminar.
   * @throws {NotFoundError}  Si el proyecto no existe.
   * @throws {ForbiddenError} Si el usuario no tiene rol suficiente.
   */
  async deleteProject(userId: string, id: string): Promise<boolean> {
    const project = await this.repo.findById(id);
    if (!project) throw new NotFoundError('Proyecto');
    await this.checkCanManage(userId, project.teamId);
    await this.repo.delete(id);
    return true;
  }

  /**
   * Verifica que el usuario es miembro del equipo con un rol que permite
   * gestionar proyectos (PRODUCT_OWNER o SCRUM_MASTER).
   *
   * @param userId - ID del usuario a verificar.
   * @param teamId - ID del equipo sobre el que se evalúan los permisos.
   * @throws {ForbiddenError} Si el usuario no es miembro o no tiene el rol necesario.
   */
  private async checkCanManage(userId: string, teamId: string): Promise<void> {
    const member = await this.db.teamMember.findUnique({
      // Clave compuesta única que identifica la membresía en el equipo
      where: { userId_teamId: { userId, teamId } },
    });
    if (!member) throw new ForbiddenError('No eres miembro de este equipo');
    // Solo PO y SM pueden crear/modificar/eliminar proyectos; DEVELOPER y STAKEHOLDER son de solo lectura
    const canManage = ['PRODUCT_OWNER', 'SCRUM_MASTER'].includes(member.role);
    if (!canManage) throw new ForbiddenError('Solo Product Owners y Scrum Masters pueden gestionar proyectos');
  }
}
