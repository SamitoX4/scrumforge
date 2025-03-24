/**
 * @file workspace.service.ts
 * @description Lógica de negocio para la gestión de workspaces.
 *
 * Responsabilidades:
 * - Crear workspaces con equipo por defecto y suscripción al plan gratuito.
 * - Actualizar y eliminar workspaces con verificación de propiedad.
 * - Consultar workspaces accesibles por un usuario (propios y como miembro).
 *
 * El servicio recibe un `WorkspaceRepository` para el acceso a datos de workspaces
 * y opcionalmente un `PrismaClient` para operaciones transversales (equipos, planes).
 */
import { PrismaClient, Workspace } from '@prisma/client';
import { WorkspaceRepository } from './workspace.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/error.utils';
import { EventStore } from '../../events/event-store';
import { EventType, AggregateType } from '../../events/event-types';
import { logger } from '../../utils/logger';

/**
 * Servicio de workspaces de ScrumForge.
 * Centraliza las reglas de negocio sobre creación, actualización y eliminación
 * de workspaces, delegando el acceso a datos en `WorkspaceRepository`.
 */
export class WorkspaceService {
  /**
   * @param repo - Repositorio de workspaces para operaciones CRUD básicas.
   * @param db   - Cliente Prisma opcional para operaciones que involucran
   *               otras entidades (equipos, planes de suscripción).
   */
  constructor(
    private readonly repo: WorkspaceRepository,
    private readonly db?: PrismaClient,
  ) {}

  /**
   * Devuelve todos los workspaces accesibles por el usuario:
   * los que posee directamente más los de equipos en los que participa.
   *
   * @param userId - ID del usuario autenticado.
   */
  async getWorkspaces(userId: string): Promise<Workspace[]> {
    return this.repo.findByMember(userId);
  }

  /**
   * Devuelve un workspace por su ID.
   *
   * @param id - ID del workspace.
   * @throws {NotFoundError} Si el workspace no existe.
   */
  async getWorkspace(id: string): Promise<Workspace> {
    const workspace = await this.repo.findById(id);
    if (!workspace) throw new NotFoundError('Workspace');
    return workspace;
  }

  /**
   * Busca un workspace por su slug URL-friendly.
   * Devuelve `null` si no existe, permitiendo al resolver devolver un 404 semántico.
   *
   * @param slug - Slug único del workspace (p. ej. `"mi-empresa"`).
   */
  async getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
    return this.repo.findBySlug(slug);
  }

  /**
   * Crea un nuevo workspace y realiza la inicialización necesaria de forma no bloqueante:
   * 1. Verifica que el slug no esté en uso.
   * 2. Crea el workspace con el usuario como `ownerId`.
   * 3. Crea un equipo "General" y añade al creador como SCRUM_MASTER.
   * 4. Asigna una suscripción al plan gratuito al nuevo workspace.
   *
   * Los pasos 3 y 4 son no fatales: si fallan, el workspace se devuelve igualmente
   * para no bloquear el flujo de onboarding del usuario.
   *
   * @param userId - ID del usuario que será propietario del workspace.
   * @param input  - Nombre y slug del nuevo workspace.
   * @throws {ConflictError} Si el slug ya está registrado.
   */
  async createWorkspace(
    userId: string,
    input: { name: string; slug: string },
  ): Promise<Workspace> {
    // Verificar unicidad del slug antes de crear para dar un error descriptivo
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`El slug "${input.slug}" ya está en uso`);
    }
    const workspace = await this.repo.create({ ...input, ownerId: userId });

    if (this.db) {
      // Crear equipo por defecto y añadir al creador como SCRUM_MASTER
      try {
        const team = await this.db.team.create({
          data: { name: 'General', workspaceId: workspace.id },
        });
        await this.db.teamMember.create({
          data: { teamId: team.id, userId, role: 'SCRUM_MASTER' },
        });
      } catch {
        // No fatal: el workspace se crea aunque el equipo por defecto falle
      }

      // Asignar plan gratuito al nuevo workspace de forma no bloqueante
      try {
        const freePlan = await this.db.plan.findFirst({ where: { name: 'free' } });
        if (freePlan) {
          await this.db.subscription.create({
            data: {
              workspaceId: workspace.id,
              planId: freePlan.id,
              status: 'ACTIVE',
            },
          });
        }
      } catch {
        // No fatal: el workspace es funcional aunque la suscripción no se pueda crear
      }
    }

    return workspace;
  }

  /**
   * Actualiza el nombre de un workspace.
   * Solo el propietario (`ownerId`) tiene permiso para modificarlo.
   *
   * @param id     - ID del workspace a actualizar.
   * @param userId - ID del usuario que realiza la petición.
   * @param input  - Nuevos datos del workspace (actualmente solo `name`).
   * @throws {NotFoundError}  Si el workspace no existe.
   * @throws {ForbiddenError} Si el usuario no es el propietario.
   */
  async updateWorkspace(
    id: string,
    userId: string,
    input: { name: string },
  ): Promise<Workspace> {
    const workspace = await this.repo.findById(id);
    if (!workspace) throw new NotFoundError('Workspace');
    // Solo el propietario directo puede renombrar el workspace
    if (workspace.ownerId !== userId) throw new ForbiddenError();
    return this.repo.update(id, input);
  }

  /**
   * Elimina permanentemente un workspace.
   * La eliminación en cascada de Prisma destruye equipos, proyectos y demás
   * entidades asociadas automáticamente.
   * Solo el propietario (`ownerId`) puede eliminar el workspace.
   *
   * Antes de borrar persiste un evento `WORKSPACE_DELETED` en la tabla `Event`
   * (Event Sourcing). A diferencia de `AuditLog`, la tabla `Event` no tiene FK
   * al workspace ni al proyecto, por lo que el registro sobrevive al borrado en
   * cascada y queda disponible para auditorías posteriores.
   *
   * @param id     - ID del workspace a eliminar.
   * @param userId - ID del usuario que realiza la petición.
   * @throws {NotFoundError}  Si el workspace no existe.
   * @throws {ForbiddenError} Si el usuario no es el propietario.
   */
  async deleteWorkspace(id: string, userId: string): Promise<boolean> {
    const workspace = await this.repo.findById(id);
    if (!workspace) throw new NotFoundError('Workspace');
    // Verificar propiedad antes de la eliminación destructiva
    if (workspace.ownerId !== userId) throw new ForbiddenError();

    // Persistir auditoría ANTES de borrar — el registro sobrevive al CASCADE
    // porque la tabla `Event` no tiene FK al workspace ni al proyecto.
    // Non-fatal: un fallo en la auditoría nunca debe bloquear la eliminación.
    const eventStore = new EventStore(this.db);
    eventStore
      .append({
        type: EventType.WORKSPACE_DELETED,
        aggregateId: id,
        aggregateType: AggregateType.WORKSPACE,
        userId,
        payload: {
          workspaceId: id,
          workspaceName: workspace.name,
          ownerId: workspace.ownerId,
          deletedAt: new Date().toISOString(),
        },
      })
      .catch((err) => {
        // No-fatal: el borrado continúa aunque la auditoría falle
        logger.error({ err, workspaceId: id }, 'No se pudo registrar la auditoría de deleteWorkspace');
      });

    await this.repo.delete(id);
    return true;
  }
}
