import { BoardService } from '../../src/modules/board/board.service';
import { DEFAULT_BOARD_COLUMNS } from '../../src/modules/board/board.types';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

const baseProject = {
  id: 'proj-1',
  name: 'Proyecto Test',
  key: 'PT',
  teamId: 'team-1',
  settings: '{}',
  createdAt: new Date(),
  updatedAt: new Date(),
  team: {
    id: 'team-1',
    name: 'Equipo',
    members: [
      { userId: 'user-po', teamId: 'team-1', role: 'PRODUCT_OWNER' },
      { userId: 'user-dev', teamId: 'team-1', role: 'DEVELOPER' },
    ],
  },
};

const mockDb = {
  project: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

const service = new BoardService(mockDb);

describe('BoardService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getBoardColumns ──────────────────────────────────────────────────────

  describe('getBoardColumns', () => {
    it('returns default columns when project has no custom config', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      const result = await service.getBoardColumns('proj-1');
      expect(result).toHaveLength(DEFAULT_BOARD_COLUMNS.length);
      expect(result[0].status).toBe('TODO');
    });

    it('returns custom columns when project has boardColumns in settings', async () => {
      const customColumns = [
        { id: 'TODO', title: 'Backlog', status: 'TODO', order: 0 },
        { id: 'DONE', title: 'Hecho', status: 'DONE', order: 1 },
      ];
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({
        ...baseProject,
        settings: JSON.stringify({ boardColumns: customColumns }),
      });
      const result = await service.getBoardColumns('proj-1');
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Backlog');
    });

    it('falls back to defaults if settings JSON is malformed', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({
        ...baseProject,
        settings: 'invalid json',
      });
      const result = await service.getBoardColumns('proj-1');
      expect(result).toHaveLength(DEFAULT_BOARD_COLUMNS.length);
    });

    it('throws NotFoundError if project does not exist', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getBoardColumns('missing')).rejects.toThrow('Proyecto');
    });
  });

  // ── updateBoardColumns ───────────────────────────────────────────────────

  describe('updateBoardColumns', () => {
    const newColumns = [
      { id: 'TODO', title: 'Por hacer', status: 'TODO', order: 0 },
      { id: 'DONE', title: 'Terminado', status: 'DONE', order: 1 },
    ];

    it('saves columns and returns them sorted by order (PO)', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      (mockDb.project.update as jest.Mock).mockResolvedValue(baseProject);
      const result = await service.updateBoardColumns('user-po', 'proj-1', newColumns);
      expect(result).toHaveLength(2);
      expect(mockDb.project.update).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenError if user is a DEVELOPER', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      await expect(
        service.updateBoardColumns('user-dev', 'proj-1', newColumns),
      ).rejects.toThrow('Product Owners');
    });

    it('throws ForbiddenError if user is not a team member', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      await expect(
        service.updateBoardColumns('outsider', 'proj-1', newColumns),
      ).rejects.toThrow('miembro');
    });

    it('throws NotFoundError if project does not exist', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateBoardColumns('user-po', 'missing', newColumns),
      ).rejects.toThrow('Proyecto');
    });

    it('preserves existing settings keys when saving', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({
        ...baseProject,
        settings: JSON.stringify({ theme: 'dark' }),
      });
      (mockDb.project.update as jest.Mock).mockResolvedValue(baseProject);
      await service.updateBoardColumns('user-po', 'proj-1', newColumns);
      const updateCall = (mockDb.project.update as jest.Mock).mock.calls[0][0];
      const saved = JSON.parse(updateCall.data.settings as string);
      expect(saved.theme).toBe('dark');
      expect(saved.boardColumns).toHaveLength(2);
    });
  });
});
