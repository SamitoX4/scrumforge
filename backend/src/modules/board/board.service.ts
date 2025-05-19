/**
 * @file board.service.ts
 * @description Servicio de negocio para la gestión del tablero Kanban.
 *
 * La configuración de columnas se almacena en el campo JSON `Project.settings`
 * como una clave `boardColumns`, evitando una tabla adicional en la BD y
 * simplificando las migraciones de esquema.
 *
 * Estrategia de lectura/escritura:
 * - Al leer, se intenta deserializar el JSON; si falla, se usa DEFAULT_BOARD_COLUMNS
 *   como fallback seguro (tolerancia a datos legados o corruptos).
 * - Al escribir, se hace un merge con la configuración existente para no
 *   sobreescribir otras claves JSON del proyecto (ej. integraciones).
 *
 * Control de acceso:
 * - Solo PRODUCT_OWNER y SCRUM_MASTER pueden modificar la estructura del tablero.
 * - La consulta de columnas es pública para cualquier miembro autenticado.
 */
import { PrismaClient } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../utils/error.utils';
import { BoardColumn, BoardSettings, DEFAULT_BOARD_COLUMNS } from './board.types';

/**
 * Servicio de negocio para la gestión del tablero Kanban.
 *
 * Almacena la configuración de columnas en el campo JSON `Project.settings`
 * para evitar una tabla separada en la BD y simplificar las migraciones.
 * La lectura usa un try/catch para tolerar el caso en que el campo `settings`
 * esté vacío o contenga JSON malformado de versiones anteriores.
 */
export class BoardService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Devuelve las columnas del tablero de un proyecto.
   * Si el proyecto no tiene columnas personalizadas, devuelve las columnas por defecto.
   *
   * El algoritmo intenta deserializar el JSON de `Project.settings`. Si falla
   * (campo nulo, JSON inválido) o si no hay columnas definidas, retorna
   * DEFAULT_BOARD_COLUMNS como fallback seguro.
   *
   * @param projectId - ID del proyecto cuyas columnas se quieren obtener
   * @returns Lista de columnas ordenadas de menor a mayor `order`
   * @throws NotFoundError si el proyecto no existe
   */
  async getBoardColumns(projectId: string): Promise<BoardColumn[]> {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Proyecto');

    try {
      const settings = JSON.parse(project.settings) as BoardSettings;
      // Solo usar las columnas personalizadas si realmente existen en la configuración
      if (settings.boardColumns && settings.boardColumns.length > 0) {
        return settings.boardColumns.sort((a, b) => a.order - b.order);
      }
    } catch {
      // settings es JSON inválido o no tiene boardColumns — usar las columnas por defecto
    }

    return DEFAULT_BOARD_COLUMNS;
  }

  /**
   * Actualiza la configuración de columnas del tablero.
   * Solo Product Owners y Scrum Masters pueden hacerlo.
   *
   * La actualización hace un merge del campo `boardColumns` dentro del JSON de
   * `settings`, preservando cualquier otra configuración existente (ej. integraciones).
   * Si `order` no está definido en una columna, se asigna el índice de la posición
   * en el array como valor por defecto.
   *
   * @param userId    - ID del usuario que solicita el cambio (se verifica su rol)
   * @param projectId - ID del proyecto a configurar
   * @param columns   - Nueva lista de columnas a guardar
   * @returns Lista de columnas guardada, ordenada por `order`
   * @throws NotFoundError si el proyecto no existe
   * @throws ForbiddenError si el usuario no es miembro o no tiene rol suficiente
   */
  async updateBoardColumns(
    userId: string,
    projectId: string,
    columns: BoardColumn[],
  ): Promise<BoardColumn[]> {
    const project = await this.db.project.findUnique({
      where: { id: projectId },
      // Se incluyen los miembros del equipo para verificar el rol sin una query extra
      include: { team: { include: { members: true } } },
    });
    if (!project) throw new NotFoundError('Proyecto');

    const member = project.team.members.find((m) => m.userId === userId);
    if (!member) throw new ForbiddenError('No eres miembro de este proyecto');

    // Solo los roles de gestión pueden cambiar la estructura del tablero
    const canManage = ['PRODUCT_OWNER', 'SCRUM_MASTER'].includes(member.role);
    if (!canManage) throw new ForbiddenError('Solo Product Owners y Scrum Masters pueden configurar el tablero');

    // Leer la configuración existente para hacer un merge parcial (no sobreescribir otras claves)
    let currentSettings: Record<string, unknown> = {};
    try {
      currentSettings = JSON.parse(project.settings) as Record<string, unknown>;
    } catch {
      // Ignorar errores de parseo — se empieza desde cero si el JSON no es válido
    }

    // Normalizar el `order` de cada columna usando su posición en el array como fallback
    const newSettings = JSON.stringify({
      ...currentSettings,
      boardColumns: columns.map((col, i) => ({ ...col, order: col.order ?? i })),
    });

    await this.db.project.update({
      where: { id: projectId },
      data: { settings: newSettings },
    });

    // Devolver las columnas con el mismo orden que se guardaron
    return columns.sort((a, b) => a.order - b.order);
  }
}
