import { PrismaClient, UserStory, Prisma } from '@prisma/client';

/**
 * Repositorio de acceso a datos para la entidad UserStory.
 *
 * Centraliza todas las queries de historias de usuario para que el servicio
 * no dependa directamente de Prisma. Esto facilita el testing mediante mocks
 * y mantiene la lógica de base de datos separada de las reglas de negocio.
 */
export class UserStoryRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Busca una historia de usuario por su identificador único.
   *
   * @param id - ID de la historia
   * @returns La historia encontrada o null si no existe
   */
  async findById(id: string): Promise<UserStory | null> {
    return this.db.userStory.findUnique({ where: { id } });
  }

  /**
   * Obtiene historias de usuario con filtros opcionales de sprint y épica.
   * El spread condicional evita añadir el filtro si el valor es undefined,
   * lo que permite a los callers omitir campos sin afectar la query.
   *
   * @param filter.projectId - Obligatorio; acota las historias al proyecto
   * @param filter.sprintId  - null = sin sprint (backlog); undefined = todos
   * @param filter.epicId    - null = sin épica; undefined = todas
   * @returns Lista de historias ordenadas por campo `order` ascendente
   */
  async findMany(filter: {
    projectId: string;
    sprintId?: string | null;
    epicId?: string | null;
  }): Promise<UserStory[]> {
    return this.db.userStory.findMany({
      where: {
        projectId: filter.projectId,
        // Solo añadir el filtro si el campo fue explícitamente pasado
        ...(filter.sprintId !== undefined ? { sprintId: filter.sprintId } : {}),
        ...(filter.epicId !== undefined ? { epicId: filter.epicId } : {}),
      },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Obtiene las historias del backlog de un proyecto (sin sprint asignado).
   * El backlog solo incluye historias con sprintId = null, excluyendo
   * las que ya están comprometidas en algún sprint.
   *
   * @param projectId - ID del proyecto
   * @returns Lista de historias del backlog ordenadas por `order`
   */
  async findBacklog(projectId: string): Promise<UserStory[]> {
    return this.db.userStory.findMany({
      where: { projectId, sprintId: null },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Crea una nueva historia de usuario asignándole automáticamente la última
   * posición del backlog del proyecto.
   *
   * El orden se calcula como `maxOrder + 1` para que la nueva historia aparezca
   * siempre al final. Si no hay historias previas (last === null), se empieza en 0.
   *
   * @param data - Campos requeridos y opcionales de la historia
   * @returns La historia creada con su ID generado y `order` calculado
   */
  async create(data: {
    title: string;
    description?: string;
    projectId: string;
    epicId?: string;
    priority?: string;
    points?: number;
    assigneeId?: string;
  }): Promise<UserStory> {
    // Obtener el mayor orden actual para añadir la historia al final
    const last = await this.db.userStory.findFirst({
      where: { projectId: data.projectId },
      orderBy: { order: 'desc' },
    });
    return this.db.userStory.create({
      data: { ...data, order: (last?.order ?? -1) + 1 },
    });
  }

  /**
   * Actualiza campos específicos de una historia de usuario.
   *
   * El campo `customFields` requiere un tratamiento especial porque Prisma
   * espera un `InputJsonValue` y no acepta directamente un `Record<string, unknown>`.
   * El resto de campos se pasan sin transformación.
   *
   * @param id   - ID de la historia a actualizar
   * @param data - Campos a modificar; solo los campos incluidos se actualizan
   * @returns La historia con los datos actualizados
   */
  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      epicId?: string | null;
      sprintId?: string | null;
      status?: string;
      priority?: string;
      points?: number | null;
      assigneeId?: string | null;
      order?: number;
      isBlocked?: boolean;
      blockedReason?: string | null;
      customFields?: Record<string, unknown>;
    },
  ): Promise<UserStory> {
    // Separar customFields del resto para hacer el cast de tipo correcto
    const { customFields, ...rest } = data;
    const updateData: Prisma.UserStoryUpdateInput = { ...rest };
    if (customFields !== undefined) {
      // Prisma requiere el cast explícito para tipos JSON arbitrarios
      updateData.customFields = customFields as Prisma.InputJsonValue;
    }
    return this.db.userStory.update({ where: { id }, data: updateData });
  }

  /**
   * Elimina permanentemente una historia de usuario.
   * El servicio debe haber verificado permisos antes de llamar a este método.
   *
   * @param id - ID de la historia a eliminar
   */
  async delete(id: string): Promise<void> {
    await this.db.userStory.delete({ where: { id } });
  }

  /**
   * Reordena las historias del backlog moviendo una historia a una nueva posición.
   *
   * Algoritmo:
   * 1. Si la épica cambia, actualizarla primero en la BD.
   * 2. Cargar todas las historias del backlog ordenadas.
   * 3. Extraer la historia movida de su posición actual (splice).
   * 4. Insertarla en la nueva posición (clampada al rango válido).
   * 5. Persistir todos los nuevos valores de `order` en una transacción atómica.
   *
   * La transacción garantiza que no queden órdenes inconsistentes si alguna
   * actualización individual falla.
   *
   * @param projectId     - ID del proyecto (limita el scope del reorden)
   * @param storyId       - ID de la historia que se está moviendo
   * @param newPosition   - Posición destino (0-based)
   * @param targetEpicId  - Nueva épica; undefined = no cambiar, null = sin épica
   * @returns Lista completa de historias del backlog con los nuevos órdenes
   */
  async reorder(
    projectId: string,
    storyId: string,
    newPosition: number,
    targetEpicId?: string | null,
  ): Promise<UserStory[]> {
    // Si la épica cambia, actualizarla antes de reordenar para no perder el cambio
    if (targetEpicId !== undefined) {
      await this.db.userStory.update({
        where: { id: storyId },
        data: { epicId: targetEpicId ?? null },
      });
    }

    // Cargar el backlog completo para poder reordenarlo en memoria
    const stories = await this.db.userStory.findMany({
      where: { projectId, sprintId: null },
      orderBy: { order: 'asc' },
    });

    const currentIdx = stories.findIndex((s) => s.id === storyId);
    // Si la historia no está en el backlog (está en un sprint), no hacer nada
    if (currentIdx === -1) return stories;

    // Extraer la historia de su posición actual y reinsertarla en la nueva
    const [story] = stories.splice(currentIdx, 1);
    // Clampear para que la posición no salga del rango válido del array
    const clampedPos = Math.max(0, Math.min(newPosition, stories.length));
    stories.splice(clampedPos, 0, story);

    // Persistir todos los cambios de orden en una sola transacción atómica
    await this.db.$transaction(
      stories.map((s, i) => this.db.userStory.update({ where: { id: s.id }, data: { order: i } })),
    );

    // Devolver el array con los órdenes actualizados sin nueva query a la BD
    return stories.map((s, i) => ({ ...s, order: i }));
  }
}
