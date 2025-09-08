import { DEFAULT_BOARD_COLUMNS } from '../../src/modules/board/board.types';
import { UnauthorizedError } from '../../src/utils/error.utils';

const mockGetBoardColumns = jest.fn();
const mockUpdateBoardColumns = jest.fn();
const mockAsyncIterator = jest.fn();

jest.mock('../../src/modules/board/board.service', () => ({
  BoardService: jest.fn().mockImplementation(() => ({
    getBoardColumns: mockGetBoardColumns,
    updateBoardColumns: mockUpdateBoardColumns,
  })),
}));
jest.mock('../../src/config/db/prisma.client', () => ({ prisma: {} }));
jest.mock('../../src/realtime/pubsub', () => ({
  pubsub: { asyncIterator: mockAsyncIterator },
  BOARD_UPDATED_CHANNEL: (id: string) => `BOARD_UPDATED_${id}`,
}));

import { boardResolvers } from '../../src/modules/board/board.resolver';

const authCtx = { prisma: {}, user: { id: 'user-1', email: 'u@test.com', name: 'User' } };
const anonCtx = { prisma: {}, user: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBoardColumns.mockResolvedValue(DEFAULT_BOARD_COLUMNS);
  mockUpdateBoardColumns.mockResolvedValue(DEFAULT_BOARD_COLUMNS);
});

describe('boardResolvers', () => {
  describe('Query.boardColumns', () => {
    it('throws UnauthorizedError when no user in context', async () => {
      await expect(
        boardResolvers.Query.boardColumns(null, { projectId: 'proj-1' }, anonCtx as any),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('returns columns for authenticated user', async () => {
      const result = await boardResolvers.Query.boardColumns(null, { projectId: 'proj-1' }, authCtx as any);
      expect(mockGetBoardColumns).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual(DEFAULT_BOARD_COLUMNS);
    });
  });

  describe('Mutation.updateBoardColumns', () => {
    it('throws UnauthorizedError when no user in context', async () => {
      await expect(
        boardResolvers.Mutation.updateBoardColumns(null, { projectId: 'proj-1', columns: [] }, anonCtx as any),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('delegates to BoardService.updateBoardColumns with userId and projectId', async () => {
      const newCols = [{ id: 'c1', title: 'Custom', status: 'TODO', color: '#000', order: 0 }];
      const result = await boardResolvers.Mutation.updateBoardColumns(
        null,
        { projectId: 'proj-1', columns: newCols },
        authCtx as any,
      );
      expect(mockUpdateBoardColumns).toHaveBeenCalledWith('user-1', 'proj-1', newCols);
      expect(result).toEqual(DEFAULT_BOARD_COLUMNS);
    });
  });

  describe('Subscription.boardUpdated', () => {
    it('subscribes to the correct pubsub channel', () => {
      const ctx = { user: { id: 'u1', email: 'u@test.com', name: 'U' }, prisma: {} as never };
      boardResolvers.Subscription.boardUpdated.subscribe(null, { projectId: 'proj-42' }, ctx);
      expect(mockAsyncIterator).toHaveBeenCalledWith(['BOARD_UPDATED_proj-42']);
    });

    it('throws when user is not authenticated', () => {
      const ctx = { user: null, prisma: {} as never };
      expect(() =>
        boardResolvers.Subscription.boardUpdated.subscribe(null, { projectId: 'proj-42' }, ctx),
      ).toThrow();
    });
  });
});
