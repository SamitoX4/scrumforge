/**
 * @file workspace.repository.ts
 * @description Capa de acceso a datos para workspaces.
 *
 * El repositorio encapsula todas las consultas a Prisma relacionadas con
 * la entidad `Workspace`. El servicio nunca llama a Prisma directamente,
 * lo que facilita sustituir esta capa por un mock en tests unitarios.
 */
import { PrismaClient, Workspace } from '@prisma/client';

/**
 * Repositorio de workspaces.
 * Cada método traduce una operación de negocio a una consulta Prisma concreta.
 */
export class WorkspaceRepository {
  /**
   * @param db - Cliente Prisma inyectado desde el contexto de la petición.
   */
  constructor(private readonly db: PrismaClient) {}

  /**
   * Devuelve todos los workspaces cuyo propietario directo es `ownerId`.
   * Se usa para obtener los workspaces que el usuario ha creado.
   *
   * @param ownerId - ID del usuario propietario.
   */
  async findByOwner(ownerId: string): Promise<Workspace[]> {
    return this.db.workspace.findMany({ where: { ownerId } });
  }

  /**
   * Devuelve todos los workspaces a los que el usuario tiene acceso,
   * ya sea como propietario o como miembro de algún equipo del workspace.
   *
   * El algoritmo:
   * 1. Obtiene workspaces donde el usuario es `ownerId`.
   * 2. Obtiene los `TeamMember` del usuario e incluye el workspace de cada equipo.
   * 3. Fusiona ambas listas y elimina duplicados por ID (un propietario
   *    puede también ser miembro de equipos dentro de su propio workspace).
   *
   * @param userId - ID del usuario.
   */
  async findByMember(userId: string): Promise<Workspace[]> {
    // Obtener en paralelo los workspaces propios y los workspaces de equipos donde el usuario es miembro
    const [owned, memberships] = await Promise.all([
      this.db.workspace.findMany({ where: { ownerId: userId } }),
      this.db.teamMember.findMany({
        where: { userId },
        include: { team: { include: { workspace: true } } },
      }),
    ]);
    const memberWorkspaces = memberships.map((m) => m.team.workspace);
    // Deduplicar por ID usando un Set para mantener O(n) en lugar de O(n²)
    const seen = new Set<string>();
    return [...owned, ...memberWorkspaces].filter((w) => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
  }

  /**
   * Busca un workspace por su ID primario.
   * Devuelve `null` si no existe para que el servicio decida cómo manejar el caso.
   *
   * @param id - ID del workspace.
   */
  async findById(id: string): Promise<Workspace | null> {
    return this.db.workspace.findUnique({ where: { id } });
  }

  /**
   * Busca un workspace por su slug único (identificador URL-friendly).
   *
   * @param slug - Slug del workspace, p. ej. `"mi-empresa"`.
   */
  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.db.workspace.findUnique({ where: { slug } });
  }

  /**
   * Crea un nuevo workspace en la base de datos.
   *
   * @param data - Nombre, slug y propietario del workspace.
   */
  async create(data: { name: string; slug: string; ownerId: string }): Promise<Workspace> {
    return this.db.workspace.create({ data });
  }

  /**
   * Actualiza el nombre de un workspace existente.
   *
   * @param id   - ID del workspace a actualizar.
   * @param data - Campos a modificar (actualmente sólo `name`).
   */
  async update(id: string, data: { name: string }): Promise<Workspace> {
    return this.db.workspace.update({ where: { id }, data });
  }

  /**
   * Elimina un workspace permanentemente.
   * Prisma aplica `onDelete: Cascade` en los modelos relacionados,
   * por lo que equipos, proyectos y demás datos asociados también se eliminan.
   *
   * @param id - ID del workspace a eliminar.
   */
  async delete(id: string): Promise<void> {
    await this.db.workspace.delete({ where: { id } });
  }
}
