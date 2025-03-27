/**
 * @file workspace-invitation.service.ts
 * @module workspace-invitation
 * @description Servicio de lógica de negocio para invitaciones a workspaces.
 *
 * Implementa el flujo completo de invitaciones con todas sus validaciones:
 * - Verificación de que el workspace existe.
 * - Verificación de permisos del invitador (propietario o miembro).
 * - Prevención de invitar a usuarios que ya son miembros.
 * - Prevención de invitaciones duplicadas activas.
 * - Generación de tokens seguros (32 bytes, 64 chars hex).
 * - Envío de email de invitación de forma fire-and-forget.
 *
 * Los tokens expiran en `INVITATION_EXPIRY_DAYS` días (7 por defecto).
 */

import crypto from 'crypto';
import { PrismaClient, WorkspaceInvitation } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/error.utils';
import { EmailService } from '../../services/email.service';

/** Días de validez del token de invitación antes de expirar. */
const INVITATION_EXPIRY_DAYS = 7;

/**
 * @class WorkspaceInvitationService
 * @description Gestiona el ciclo de vida completo de las invitaciones a workspace.
 * Instancia un `EmailService` internamente para el envío de correos.
 */
export class WorkspaceInvitationService {
  private readonly emailService: EmailService;

  constructor(private readonly db: PrismaClient) {
    this.emailService = new EmailService();
  }

  /**
   * Invita a un nuevo miembro al workspace por correo electrónico.
   *
   * Flujo de validaciones (en orden):
   * 1. El workspace debe existir.
   * 2. El invitador debe ser propietario o miembro del workspace.
   * 3. El email invitado no puede ser de un miembro existente.
   * 4. No puede haber una invitación pendiente activa para ese email+workspace.
   * 5. Se crea la invitación y se envía el email (fire-and-forget).
   *
   * @param workspaceId - ID del workspace.
   * @param inviterUserId - ID del usuario que realiza la invitación.
   * @param email - Correo del usuario a invitar.
   * @param role - Rol que tendrá el nuevo miembro.
   * @returns La invitación recién creada.
   * @throws NotFoundError si el workspace no existe.
   * @throws ForbiddenError si el invitador no tiene permisos.
   * @throws ConflictError si el usuario ya es miembro o ya tiene invitación activa.
   */
  async inviteMember(
    workspaceId: string,
    inviterUserId: string,
    email: string,
    role: string,
  ): Promise<WorkspaceInvitation> {
    // 1. Verify workspace exists
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundError('Workspace');

    // 2. Verify inviter is owner or member of workspace (via teams)
    const isOwner = workspace.ownerId === inviterUserId;
    if (!isOwner) {
      // Si no es propietario, se verifica si es miembro de algún equipo del workspace
      const teams = await this.db.team.findMany({ where: { workspaceId } });
      const teamIds = teams.map((t) => t.id);
      const membership = await this.db.teamMember.findFirst({
        where: { userId: inviterUserId, teamId: { in: teamIds } },
      });
      if (!membership) throw new ForbiddenError('No tienes permisos para invitar miembros a este workspace');
    }

    // 3. Verify email is not already a member of the workspace
    // Se obtienen los teams del workspace para buscar membresías existentes
    const teams = await this.db.team.findMany({ where: { workspaceId } });
    const teamIds = teams.map((t) => t.id);
    const existingUser = await this.db.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await this.db.teamMember.findFirst({
        where: { userId: existingUser.id, teamId: { in: teamIds } },
      });
      if (alreadyMember) throw new ConflictError('El usuario ya es miembro de este workspace');
    }

    // 4. Verify no pending invitation exists for this email+workspace
    const now = new Date();
    const existing = await this.db.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        acceptedAt: null,       // No aceptada
        expiresAt: { gt: now }, // No expirada
      },
    });
    if (existing) throw new ConflictError('Ya existe una invitación pendiente para este correo');

    // 5. Create invitation
    // Token de 32 bytes = 64 caracteres hexadecimales; criptográficamente seguro
    const token = crypto.randomBytes(32).toString('hex');

    // Se calcula la expiración convirtiendo días a milisegundos
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const invitation = await this.db.workspaceInvitation.create({
      data: { workspaceId, email, role, token, expiresAt },
    });

    // 6. Send email (fire-and-forget: los errores de email no bloquean la respuesta)
    const inviter = await this.db.user.findUnique({ where: { id: inviterUserId } });
    const inviterName = inviter?.name ?? 'Un miembro del equipo'; // Fallback si no existe el invitador
    this.emailService
      .sendWorkspaceInvitationEmail(email, inviterName, workspace.name, token)
      .catch(() => undefined); // Se descarta el error intencionalmente

    return invitation;
  }

  /**
   * Acepta una invitación pendiente añadiendo al usuario como miembro del workspace.
   *
   * Flujo:
   * 1. Se busca la invitación por token.
   * 2. Se valida que no esté expirada ni ya aceptada.
   * 3. Se obtiene el primer equipo del workspace para la membresía.
   * 4. Se crea la membresía si el usuario no era ya miembro del equipo.
   * 5. Se marca la invitación como aceptada.
   *
   * @param token - Token de invitación del enlace del email.
   * @param userId - ID del usuario que acepta la invitación.
   * @returns `true` si la aceptación fue exitosa.
   * @throws NotFoundError si la invitación no existe o no hay equipos en el workspace.
   * @throws ValidationError si la invitación expiró o ya fue aceptada.
   */
  async acceptInvitation(token: string, userId: string): Promise<boolean> {
    // 1. Find invitation by token
    const invitation = await this.db.workspaceInvitation.findUnique({ where: { token } });
    if (!invitation) throw new NotFoundError('Invitación');

    // 2. Verify not expired and not already accepted
    const now = new Date();
    if (invitation.expiresAt < now) throw new ValidationError('La invitación ha expirado');
    if (invitation.acceptedAt !== null) throw new ValidationError('La invitación ya fue aceptada');

    // 3. Find first team of workspace
    // Se asume que el workspace tiene al menos un equipo; si no, es un error de configuración
    const team = await this.db.team.findFirst({ where: { workspaceId: invitation.workspaceId } });
    if (!team) throw new NotFoundError('El workspace no tiene equipos');

    // 4. Create TeamMember with invitation role
    // Se verifica si ya es miembro para hacer la operación idempotente
    const existingMember = await this.db.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: team.id } },
    });
    if (!existingMember) {
      // Solo se crea si no existe la membresía; evita error de clave duplicada
      await this.db.teamMember.create({
        data: { userId, teamId: team.id, role: invitation.role },
      });
    }

    // 5. Mark invitation as accepted
    await this.db.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: now },
    });

    return true;
  }

  /**
   * Retorna las invitaciones activas (no aceptadas y no expiradas) de un workspace,
   * ordenadas de más reciente a más antigua.
   *
   * @param workspaceId - ID del workspace.
   * @returns Lista de invitaciones pendientes activas.
   */
  async getPendingInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const now = new Date();
    return this.db.workspaceInvitation.findMany({
      where: {
        workspaceId,
        acceptedAt: null,       // Filtra las ya aceptadas
        expiresAt: { gt: now }, // Filtra las ya expiradas
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoca (elimina) una invitación pendiente verificando que pertenezca
   * al workspace especificado (evita que un usuario revoque invitaciones ajenas).
   *
   * @param invitationId - ID de la invitación a revocar.
   * @param workspaceId - ID del workspace del contexto actual.
   * @returns `true` si la revocación fue exitosa.
   * @throws NotFoundError si la invitación no existe.
   * @throws ForbiddenError si la invitación no pertenece al workspace.
   */
  async revokeInvitation(invitationId: string, workspaceId: string): Promise<boolean> {
    const invitation = await this.db.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundError('Invitación');

    // Verificación de propiedad: la invitación debe pertenecer al workspace del contexto
    if (invitation.workspaceId !== workspaceId) {
      throw new ForbiddenError('La invitación no pertenece a este workspace');
    }

    await this.db.workspaceInvitation.delete({ where: { id: invitationId } });
    return true;
  }
}
