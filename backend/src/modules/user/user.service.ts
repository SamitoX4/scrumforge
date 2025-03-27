/**
 * @file user.service.ts
 * @description Lógica de negocio para la gestión de usuarios.
 *
 * Responsabilidades:
 * - Consultar y actualizar el perfil del usuario.
 * - Eliminar cuentas con anonimización de datos personales (cumplimiento RGPD).
 * - Gestionar la API key personal de Anthropic para las features de IA.
 * - Exportar todos los datos del usuario como JSON (derecho de portabilidad RGPD).
 *
 * La eliminación de cuenta NO borra el registro de usuario sino que lo anonimiza,
 * preservando así la integridad referencial de comentarios, tareas y demás registros.
 */
import { PrismaClient, User } from '@prisma/client';
import { UserRepository } from './user.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/error.utils';
import { comparePassword } from '../../utils/crypto.utils';

/**
 * Servicio de usuarios de ScrumForge.
 * Centraliza las reglas de negocio sobre perfiles y gestión de cuentas,
 * delegando el acceso a datos básicos en `UserRepository`.
 */
export class UserService {
  /**
   * @param repo - Repositorio de usuarios para operaciones CRUD de perfil.
   * @param db   - Cliente Prisma opcional para operaciones que involucran
   *               otras entidades (tokens, workspaces, etc.).
   */
  constructor(
    private readonly repo: UserRepository,
    private readonly db?: PrismaClient,
  ) {}

  /**
   * Devuelve el perfil completo del usuario.
   *
   * @param userId - ID del usuario.
   * @throws {NotFoundError} Si el usuario no existe.
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundError('Usuario');
    return user;
  }

  /**
   * Actualiza el nombre y/o la URL del avatar del usuario.
   * Los campos son opcionales para permitir actualizaciones parciales.
   *
   * @param userId - ID del usuario a actualizar.
   * @param data   - Campos opcionales a modificar.
   * @throws {NotFoundError} Si el usuario no existe.
   */
  async updateProfile(
    userId: string,
    data: { name?: string; avatarUrl?: string },
  ): Promise<User> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundError('Usuario');
    return this.repo.update(userId, data);
  }

  /**
   * Elimina la cuenta del usuario de forma irreversible.
   *
   * Pasos:
   * 1. Verifica la contraseña para confirmar la identidad.
   * 2. Impide la eliminación si el usuario es el único propietario de algún workspace.
   * 3. Anonimiza los datos personales del usuario en lugar de borrar el registro,
   *    preservando la integridad referencial de comentarios, tareas y demás registros.
   * 4. Elimina todos los registros de autenticación sensibles (tokens, OAuth).
   *
   * @param userId   - ID del usuario que solicita la eliminación.
   * @param password - Contraseña actual para confirmar la intención de borrado.
   * @throws {ValidationError} Si la contraseña es incorrecta.
   * @throws {ForbiddenError}  Si el usuario es el único propietario de algún workspace.
   */
  async deleteAccount(userId: string, password: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not available');

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Usuario');

    // Verificar contraseña antes de cualquier modificación destructiva
    const valid = await comparePassword(password, user.password);
    if (!valid) throw new ValidationError('Contraseña incorrecta');

    // Impedir eliminación si el usuario es el único propietario de algún workspace
    // (forzar transferencia o eliminación previa del workspace)
    const ownedWorkspaces = await this.db.workspace.findMany({ where: { ownerId: userId } });
    for (const ws of ownedWorkspaces) {
      const otherOwners = await this.db.workspace.count({
        where: { id: ws.id, ownerId: { not: userId } },
      });
      // Verificar si existe algún co-propietario (actualmente ownerId es único por workspace)
      if (otherOwners === 0) {
        throw new ForbiddenError(
          `Eres el único propietario del workspace "${ws.name}". Transfiere la propiedad o elimina el workspace antes de borrar tu cuenta.`,
        );
      }
    }

    // Anonimizar datos personales — el registro persiste para mantener integridad referencial
    await this.db.user.update({
      where: { id: userId },
      data: {
        name: 'Usuario eliminado',
        // Email único basado en el ID para no bloquear registros futuros con el mismo email
        email: `deleted-${userId}@deleted.scrumforge`,
        password: '',
        avatarUrl: null,
        emailVerifiedAt: null,
      },
    });

    // Eliminar registros de autenticación sensibles para revocar acceso inmediatamente
    await this.db.refreshToken.deleteMany({ where: { userId } });
    await this.db.emailVerificationToken.deleteMany({ where: { userId } });
    await this.db.passwordResetToken.deleteMany({ where: { userId } });
    await this.db.oAuthAccount.deleteMany({ where: { userId } });

    // Los comentarios y otras contribuciones permanecen con el authorId anonimizado

    return true;
  }

  /**
   * Guarda o sobreescribe la API key personal de Anthropic del usuario.
   * Esta key tiene prioridad sobre la clave global del servidor en el `AiService`.
   *
   * @param userId - ID del usuario.
   * @param key    - API key de Anthropic a persistir.
   */
  async saveAnthropicApiKey(userId: string, key: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not available');
    await this.db.user.update({ where: { id: userId }, data: { anthropicApiKey: key } });
    return true;
  }

  /**
   * Elimina la API key personal de Anthropic del usuario.
   * Tras la eliminación, las features de IA usarán la clave global del servidor.
   *
   * @param userId - ID del usuario.
   */
  async deleteAnthropicApiKey(userId: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not available');
    // Establecer a null en lugar de borrar el campo para mantener la estructura del modelo
    await this.db.user.update({ where: { id: userId }, data: { anthropicApiKey: null } });
    return true;
  }

  /**
   * Comprueba si el usuario tiene una API key de Anthropic guardada.
   * Solo devuelve un booleano — nunca expone la key por GraphQL.
   *
   * @param userId - ID del usuario.
   */
  async hasAnthropicApiKey(userId: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not available');
    const user = await this.db.user.findUnique({
      where: { id: userId },
      // Seleccionar solo el campo necesario para minimizar datos transferidos desde BD
      select: { anthropicApiKey: true },
    });
    // Doble negación: convierte string truthy/falsy a boolean estricto
    return !!user?.anthropicApiKey;
  }

  /**
   * Exporta todos los datos del usuario como JSON (derecho de portabilidad RGPD).
   * Recopila en paralelo membresías, historias, tareas, comentarios y notificaciones.
   *
   * @param userId - ID del usuario.
   * @returns JSON formateado con todos los datos del usuario.
   * @throws {NotFoundError} Si el usuario no existe.
   */
  async exportMyData(userId: string): Promise<string> {
    if (!this.db) throw new Error('Database not available');

    // Excluir campos sensibles como password y anthropicApiKey de la exportación
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new NotFoundError('Usuario');

    // Obtener todas las entidades relacionadas en paralelo para optimizar el tiempo de respuesta
    const [teamMemberships, assignedStories, assignedTasks, comments, notifications] =
      await Promise.all([
        this.db.teamMember.findMany({ where: { userId } }),
        this.db.userStory.findMany({ where: { assigneeId: userId } }),
        this.db.task.findMany({ where: { assigneeId: userId } }),
        this.db.comment.findMany({ where: { authorId: userId } }),
        this.db.notification.findMany({ where: { userId } }),
      ]);

    // Formatear con indentación para que sea legible directamente por el usuario
    return JSON.stringify(
      { user, teamMemberships, assignedStories, assignedTasks, comments, notifications },
      null,
      2,
    );
  }
}
