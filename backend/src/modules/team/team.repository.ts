/**
 * @file team.repository.ts
 * @description Capa de acceso a datos para equipos y miembros de equipo.
 *
 * El repositorio encapsula todas las consultas a Prisma relacionadas con las
 * entidades `Team` y `TeamMember`. El servicio nunca llama a Prisma directamente,
 * lo que facilita la sustitución por mocks en tests unitarios.
 *
 * La clave compuesta `(userId, teamId)` en `TeamMember` garantiza unicidad de
 * membresía y se usa como índice en varias operaciones de este repositorio.
 */
import { PrismaClient, Team, TeamMember } from '@prisma/client';

/**
 * Repositorio de equipos y miembros de equipo.
 * Cada método traduce una operación de negocio a una consulta Prisma concreta.
 */
export class TeamRepository {
  /**
   * @param db - Cliente Prisma inyectado desde el contexto de la petición.
   */
  constructor(private readonly db: PrismaClient) {}

  /**
   * Busca un equipo por su ID primario.
   * Devuelve `null` si no existe para que el servicio decida cómo manejar el caso.
   *
   * @param id - ID del equipo.
   */
  async findById(id: string): Promise<Team | null> {
    return this.db.team.findUnique({ where: { id } });
  }

  /**
   * Devuelve todos los equipos pertenecientes a un workspace.
   *
   * @param workspaceId - ID del workspace.
   */
  async findByWorkspace(workspaceId: string): Promise<Team[]> {
    return this.db.team.findMany({ where: { workspaceId } });
  }

  /**
   * Devuelve los equipos de un workspace en los que el usuario tiene membresía.
   * Se usa para la query `myTeams`, que filtra solo los equipos relevantes
   * para el usuario dentro del workspace activo.
   *
   * @param userId      - ID del usuario.
   * @param workspaceId - ID del workspace a filtrar.
   */
  async findTeamsForUser(userId: string, workspaceId: string): Promise<Team[]> {
    return this.db.team.findMany({
      where: {
        workspaceId,
        // Filtrar equipos donde el usuario tiene al menos un registro TeamMember
        members: { some: { userId } },
      },
    });
  }

  /**
   * Crea un nuevo equipo dentro de un workspace.
   *
   * @param data - Nombre del equipo e ID del workspace.
   */
  async create(data: { name: string; workspaceId: string }): Promise<Team> {
    return this.db.team.create({ data });
  }

  /**
   * Busca la membresía de un usuario en un equipo específico.
   * Devuelve `null` si el usuario no pertenece al equipo.
   *
   * @param teamId - ID del equipo.
   * @param userId - ID del usuario.
   */
  async getMember(teamId: string, userId: string): Promise<TeamMember | null> {
    return this.db.teamMember.findUnique({
      // Usar clave compuesta para búsqueda eficiente en el índice único
      where: { userId_teamId: { userId, teamId } },
    });
  }

  /**
   * Añade un usuario al equipo con el rol indicado.
   *
   * @param data - ID del equipo, ID del usuario y rol asignado.
   */
  async addMember(data: {
    teamId: string;
    userId: string;
    role: string;
  }): Promise<TeamMember> {
    return this.db.teamMember.create({ data });
  }

  /**
   * Elimina la membresía de un usuario en un equipo.
   * Usa la clave compuesta `(userId, teamId)` para la eliminación directa.
   *
   * @param teamId - ID del equipo.
   * @param userId - ID del usuario a eliminar.
   */
  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.db.teamMember.delete({
      where: { userId_teamId: { userId, teamId } },
    });
  }

  /**
   * Actualiza el rol de un miembro existente en el equipo.
   *
   * @param teamId - ID del equipo.
   * @param userId - ID del usuario cuyo rol se actualiza.
   * @param role   - Nuevo rol a asignar.
   */
  async updateMemberRole(
    teamId: string,
    userId: string,
    role: string,
  ): Promise<TeamMember> {
    return this.db.teamMember.update({
      where: { userId_teamId: { userId, teamId } },
      data: { role },
    });
  }
}
