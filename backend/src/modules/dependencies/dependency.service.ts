/**
 * @file dependency.service.ts
 * @description Servicio de negocio para la gestión de dependencias entre historias de usuario.
 *
 * Una dependencia modela la relación entre dos historias de usuario indicando
 * si una bloquea a otra o si simplemente están relacionadas. Los tipos soportados son:
 *
 * - BLOCKS: la historia origen bloquea a la historia destino.
 * - BLOCKED_BY: la historia origen está bloqueada por la historia destino.
 * - RELATED: relación informativa sin implicación de bloqueo.
 *
 * La detección de bloqueantes activos (`getBlockers`) permite al tablero y al
 * servicio de historias advertir al equipo antes de intentar completar una historia
 * que aún tiene dependencias sin resolver.
 */
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../utils/error.utils';

/** Tipos de dependencia válidos según el modelo de datos */
const VALID_TYPES = ['BLOCKS', 'BLOCKED_BY', 'RELATED'];

/**
 * Servicio de negocio para la gestión de dependencias entre historias de usuario.
 *
 * Permite crear, consultar y eliminar relaciones de dependencia entre historias,
 * así como verificar qué historias bloquean activamente el progreso de otra.
 */
export class DependencyService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Obtiene todas las dependencias en las que participa una historia de usuario,
   * tanto las que origina (fromStoryId) como las que recibe (toStoryId).
   *
   * Se usa la cláusula OR para recuperar la visión completa del grafo de dependencias
   * desde el punto de vista de una sola historia.
   *
   * @param storyId - ID de la historia cuyos vínculos se quieren consultar
   * @returns Lista de dependencias con datos básicos de ambas historias, ordenadas por creación
   */
  async getForStory(storyId: string) {
    return this.db.storyDependency.findMany({
      // OR: recuperar dependencias donde la historia aparece en cualquier extremo del vínculo
      where: { OR: [{ fromStoryId: storyId }, { toStoryId: storyId }] },
      include: {
        fromStory: { select: { id: true, title: true, status: true, points: true } },
        toStory:   { select: { id: true, title: true, status: true, points: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Crea una nueva dependencia entre dos historias de usuario.
   *
   * Validaciones previas:
   * - El tipo debe ser uno de: BLOCKS, BLOCKED_BY, RELATED.
   * - Una historia no puede depender de sí misma (fromStoryId !== toStoryId).
   *
   * @param fromStoryId  - ID de la historia origen de la dependencia
   * @param toStoryId    - ID de la historia destino de la dependencia
   * @param type         - Tipo de relación: BLOCKS | BLOCKED_BY | RELATED
   * @param createdById  - ID del usuario que crea la dependencia (para trazabilidad)
   * @returns La dependencia creada con datos básicos de ambas historias
   * @throws ValidationError si el tipo no es válido o si las historias son la misma
   */
  async add(fromStoryId: string, toStoryId: string, type: string, createdById: string) {
    // Validar el tipo antes de persistir para fallar rápido con un error descriptivo
    if (!VALID_TYPES.includes(type)) throw new ValidationError(`Tipo inválido: ${type}`);
    // Prevenir dependencias circulares triviales (una historia dependiendo de sí misma)
    if (fromStoryId === toStoryId) throw new ValidationError('Una historia no puede depender de sí misma');

    return this.db.storyDependency.create({
      data: { fromStoryId, toStoryId, type, createdById },
      include: {
        fromStory: { select: { id: true, title: true, status: true } },
        toStory:   { select: { id: true, title: true, status: true } },
      },
    });
  }

  /**
   * Elimina una dependencia por su ID.
   *
   * @param id - ID de la dependencia a eliminar
   * @returns true si se eliminó correctamente
   */
  async remove(id: string): Promise<boolean> {
    await this.db.storyDependency.delete({ where: { id } });
    return true;
  }

  /**
   * Devuelve los IDs de las historias que bloquean activamente a una historia dada.
   *
   * Una historia bloqueante es aquella que:
   * 1. Tiene una relación de tipo BLOCKED_BY con la historia consultada.
   * 2. Su estado NO es DONE (si ya está completada, deja de ser un bloqueante activo).
   *
   * Se usa en el tablero para mostrar advertencias visuales y en el servicio
   * de historias para impedir marcaciones como completadas mientras hay bloqueantes.
   *
   * @param storyId - ID de la historia cuyos bloqueantes activos se quieren identificar
   * @returns Array de IDs de historias que bloquean activamente la historia consultada
   */
  async getBlockers(storyId: string): Promise<string[]> {
    const deps = await this.db.storyDependency.findMany({
      where: { fromStoryId: storyId, type: 'BLOCKED_BY' },
      include: { toStory: { select: { id: true, status: true } } },
    });
    // Filtrar solo las historias que aún no están completadas (bloqueantes activos)
    return deps
      .filter((d) => d.toStory.status !== 'DONE')
      .map((d) => d.toStory.id);
  }
}
