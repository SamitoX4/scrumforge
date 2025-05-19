/**
 * @file board.resolver.ts
 * @description Resolvers GraphQL para el módulo de Tablero Kanban.
 *
 * Expone:
 * - Query `boardColumns`: configuración actual de columnas del tablero.
 * - Mutation `updateBoardColumns`: actualiza la estructura del tablero (PO/SM).
 * - Subscription `boardUpdated`: emite en tiempo real cuando una historia
 *   cambia de columna (por ejemplo, via drag & drop en el frontend).
 *
 * Decisión de diseño — instancia compartida:
 * A diferencia de otros módulos, el BoardService usa el cliente Prisma global
 * en lugar de uno por petición. Esto es válido porque el servicio no accede
 * a datos específicos del contexto de usuario más allá de la autenticación.
 *
 * La suscripción `boardUpdated` es específica por proyecto para aislar
 * los eventos entre proyectos distintos.
 */
import { prisma } from '../../config/db/prisma.client';
import { BoardService } from './board.service';
import type { GraphQLContext } from '../../graphql/context';
import { UnauthorizedError } from '../../utils/error.utils';
import type { BoardColumn } from './board.types';
import { pubsub, BOARD_UPDATED_CHANNEL } from '../../realtime/pubsub';

/**
 * Instancia compartida de BoardService que usa el cliente Prisma global.
 * A diferencia de otros módulos (sprint, user-story), el board no necesita
 * aislamiento por petición porque no accede a datos del contexto de usuario
 * más allá de la verificación de autenticación.
 */
const boardService = new BoardService(prisma);

/**
 * Resolvers GraphQL para el módulo de Tablero (Board).
 *
 * Expone:
 * - Query `boardColumns`: devuelve la configuración de columnas del tablero.
 * - Mutation `updateBoardColumns`: actualiza la configuración de columnas.
 * - Subscription `boardUpdated`: emite en tiempo real cuando una historia
 *   cambia de columna (p. ej. por drag & drop).
 *
 * Control de acceso:
 * - Todas las operaciones requieren usuario autenticado.
 * - La mutación verifica internamente que el usuario sea PO o SM.
 */
export const boardResolvers = {
  Query: {
    /**
     * Devuelve las columnas del tablero Kanban de un proyecto.
     * Si el proyecto no tiene columnas personalizadas, retorna las columnas
     * por defecto definidas en DEFAULT_BOARD_COLUMNS.
     *
     * @param args.projectId - ID del proyecto cuyo tablero se consulta
     * @returns Lista de columnas ordenadas por `order`
     * @throws UnauthorizedError si no hay usuario en el contexto
     */
    boardColumns: async (
      _: unknown,
      args: { projectId: string },
      context: GraphQLContext,
    ): Promise<BoardColumn[]> => {
      if (!context.user) throw new UnauthorizedError();
      return boardService.getBoardColumns(args.projectId);
    },
  },

  Mutation: {
    /**
     * Actualiza la configuración de columnas del tablero de un proyecto.
     * Solo Product Owners y Scrum Masters pueden modificar la estructura del tablero.
     * La nueva configuración se persiste en el campo JSON `Project.settings`.
     *
     * @param args.projectId - ID del proyecto a configurar
     * @param args.columns   - Nueva lista de columnas con sus propiedades
     * @returns Lista de columnas actualizada, ordenada por `order`
     * @throws UnauthorizedError si no hay usuario autenticado
     * @throws ForbiddenError si el usuario no es PO ni SM (verificado en el servicio)
     */
    updateBoardColumns: async (
      _: unknown,
      args: { projectId: string; columns: BoardColumn[] },
      context: GraphQLContext,
    ): Promise<BoardColumn[]> => {
      if (!context.user) throw new UnauthorizedError();
      return boardService.updateBoardColumns(context.user.id, args.projectId, args.columns);
    },
  },

  Subscription: {
    /**
     * Suscripción en tiempo real que emite la historia de usuario actualizada
     * cada vez que su estado cambia en el tablero (p. ej. drag & drop entre columnas).
     *
     * El canal es específico por proyecto para no mezclar eventos de proyectos distintos.
     * El cliente solo recibe eventos del proyecto al que está suscrito.
     *
     * @param projectId - ID del proyecto cuyo tablero se observa
     * @returns AsyncIterator que emite objetos `{ boardUpdated: UserStory }`
     * @throws UnauthorizedError si no hay usuario autenticado
     */
    boardUpdated: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subscribe: (_: unknown, { projectId }: { projectId: string }, context: GraphQLContext): AsyncIterator<any> => {
        if (!context.user) throw new UnauthorizedError();
        // Se crea el iterador sobre el canal específico del proyecto
        return pubsub.asyncIterableIterator([BOARD_UPDATED_CHANNEL(projectId)]);
      },
    },
  },
};
