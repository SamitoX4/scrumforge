/**
 * @file team.service.ts
 * @description Lógica de negocio para la gestión de equipos y miembros.
 *
 * Responsabilidades:
 * - Consultar equipos por ID o por workspace/usuario.
 * - Crear equipos con el creador como SCRUM_MASTER por defecto.
 * - Invitar, eliminar y actualizar el rol de miembros con verificación de permisos.
 * - Garantizar que siempre exista al menos un PRODUCT_OWNER en el equipo.
 *
 * Solo los miembros con rol PRODUCT_OWNER o SCRUM_MASTER pueden gestionar el equipo.
 * La regla del "último PO" previene que un equipo quede sin propietario de producto.
 */
import { Team, TeamMember } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { TeamRepository } from './team.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/error.utils';

/**
 * Servicio de equipos de ScrumForge.
 * Centraliza las reglas de negocio sobre equipos y membresías,
 * delegando el acceso a datos en `TeamRepository`.
 */
export class TeamService {
  /**
   * @param repo - Repositorio de equipos para operaciones CRUD básicas.
   * @param db   - Cliente Prisma para operaciones transversales (verificar usuarios por email, etc.).
   */
  constructor(
    private readonly repo: TeamRepository,
    private readonly db: PrismaClient,
  ) {}

  /**
   * Devuelve un equipo por su ID.
   *
   * @param id - ID del equipo.
   * @throws {NotFoundError} Si el equipo no existe.
   */
  async getTeam(id: string): Promise<Team> {
    const team = await this.repo.findById(id);
    if (!team) throw new NotFoundError('Equipo');
    return team;
  }

  /**
   * Devuelve los equipos del workspace en los que el usuario tiene membresía.
   *
   * @param userId      - ID del usuario autenticado.
   * @param workspaceId - ID del workspace donde buscar los equipos.
   */
  async getMyTeams(userId: string, workspaceId: string): Promise<Team[]> {
    return this.repo.findTeamsForUser(userId, workspaceId);
  }

  /**
   * Crea un nuevo equipo y añade al creador como SCRUM_MASTER automáticamente.
   * Esto garantiza que todo equipo nuevo tenga al menos un gestor desde el primer momento.
   *
   * @param userId - ID del usuario que crea el equipo (será SCRUM_MASTER).
   * @param input  - Nombre e ID del workspace del nuevo equipo.
   */
  async createTeam(userId: string, input: { name: string; workspaceId: string }): Promise<Team> {
    const team = await this.repo.create(input);
    // El creador se convierte en SCRUM_MASTER automáticamente para poder gestionar el equipo
    await this.repo.addMember({ teamId: team.id, userId, role: 'SCRUM_MASTER' });
    return team;
  }

  /**
   * Invita a un usuario al equipo buscándolo por email.
   * Verifica que el solicitante tenga permisos de gestión y que el usuario
   * no sea ya miembro del equipo.
   *
   * @param requesterId - ID del usuario que realiza la invitación.
   * @param input       - ID del equipo, email del invitado y rol a asignar.
   * @throws {ForbiddenError}  Si el solicitante no tiene permisos de gestión.
   * @throws {NotFoundError}   Si no existe un usuario con ese email.
   * @throws {ConflictError}   Si el usuario ya es miembro del equipo.
   */
  async inviteMember(
    requesterId: string,
    input: { teamId: string; email: string; role: string },
  ): Promise<TeamMember> {
    await this.checkCanManageTeam(requesterId, input.teamId);

    // Buscar el usuario por email para obtener su ID
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    if (!user) throw new NotFoundError('Usuario con ese correo');

    const existing = await this.repo.getMember(input.teamId, user.id);
    if (existing) throw new ConflictError('El usuario ya es miembro del equipo');

    return this.repo.addMember({ teamId: input.teamId, userId: user.id, role: input.role });
  }

  /**
   * Elimina la membresía de un usuario en el equipo.
   * Si el miembro a eliminar es PRODUCT_OWNER, verifica que no sea el último PO
   * antes de proceder con la eliminación.
   *
   * @param requesterId - ID del usuario que solicita la eliminación.
   * @param teamId      - ID del equipo.
   * @param userId      - ID del usuario a eliminar.
   * @throws {ForbiddenError}  Si el solicitante no tiene permisos o intenta eliminar al único PO.
   * @throws {NotFoundError}   Si el miembro no existe en el equipo.
   */
  async removeMember(requesterId: string, teamId: string, userId: string): Promise<boolean> {
    await this.checkCanManageTeam(requesterId, teamId);
    const member = await this.repo.getMember(teamId, userId);
    if (!member) throw new NotFoundError('Miembro');
    // Evitar eliminar al último PO — protección de integridad del equipo
    if (member.role === 'PRODUCT_OWNER') {
      await this.checkAtLeastOnePO(teamId, userId);
    }
    await this.repo.removeMember(teamId, userId);
    return true;
  }

  /**
   * Cambia el rol de un miembro del equipo.
   * Si el miembro actualmente es PRODUCT_OWNER y se le asigna un rol distinto,
   * verifica que no sea el último PO del equipo antes de proceder.
   *
   * @param requesterId - ID del usuario que realiza el cambio de rol.
   * @param teamId      - ID del equipo.
   * @param userId      - ID del usuario cuyo rol se modifica.
   * @param role        - Nuevo rol a asignar.
   * @throws {ForbiddenError}  Si el solicitante no tiene permisos o intenta degradar al único PO.
   * @throws {NotFoundError}   Si el miembro no existe en el equipo.
   */
  async updateMemberRole(
    requesterId: string,
    teamId: string,
    userId: string,
    role: string,
  ): Promise<TeamMember> {
    await this.checkCanManageTeam(requesterId, teamId);
    const member = await this.repo.getMember(teamId, userId);
    if (!member) throw new NotFoundError('Miembro');
    // Si el miembro es PO y se le va a cambiar a otro rol, verificar que haya otro PO
    if (member.role === 'PRODUCT_OWNER' && role !== 'PRODUCT_OWNER') {
      await this.checkAtLeastOnePO(teamId, userId);
    }
    return this.repo.updateMemberRole(teamId, userId, role);
  }

  /**
   * Verifica que, excluyendo al usuario indicado, quede al menos un PRODUCT_OWNER en el equipo.
   * Se llama antes de eliminar o degradar a un PO para mantener la integridad del equipo.
   *
   * @param teamId        - ID del equipo a verificar.
   * @param excludeUserId - ID del usuario que se va a eliminar/degradar (se excluye del conteo).
   * @throws {ForbiddenError} Si no quedaría ningún PO tras la operación.
   */
  private async checkAtLeastOnePO(teamId: string, excludeUserId: string): Promise<void> {
    const pos = await this.db.teamMember.findMany({
      where: { teamId, role: 'PRODUCT_OWNER' },
    });
    // Excluir al usuario que se va a eliminar/degradar del conteo
    const remaining = pos.filter((m) => m.userId !== excludeUserId);
    if (remaining.length === 0) {
      throw new ForbiddenError('Debe haber al menos un Product Owner en el equipo');
    }
  }

  /**
   * Verifica que el usuario es miembro del equipo con un rol que permite
   * gestionar otros miembros (PRODUCT_OWNER o SCRUM_MASTER).
   *
   * @param userId - ID del usuario a verificar.
   * @param teamId - ID del equipo sobre el que se evalúan los permisos.
   * @throws {ForbiddenError} Si el usuario no es miembro o no tiene el rol necesario.
   */
  private async checkCanManageTeam(userId: string, teamId: string): Promise<void> {
    const member = await this.repo.getMember(teamId, userId);
    if (!member) throw new ForbiddenError('No eres miembro de este equipo');
    // Solo PO y SM pueden invitar/eliminar/modificar miembros
    const canManage = ['PRODUCT_OWNER', 'SCRUM_MASTER'].includes(member.role);
    if (!canManage) throw new ForbiddenError('Solo Product Owners y Scrum Masters pueden gestionar el equipo');
  }
}
