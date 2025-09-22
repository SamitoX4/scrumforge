import { ImpedimentService } from '../../src/modules/impediment/impediment.service';
import { PrismaClient } from '@prisma/client';

jest.mock('../../src/realtime/notification.socket', () => ({
  publishNotificationAdded: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockDb = {
  impediment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

const service = new ImpedimentService(mockDb);

describe('ImpedimentService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('happy path: calls db.impediment.create with sanitized title and calls notifyScrumMasters', async () => {
      const mockImp = {
        id: 'imp-1',
        title: 'Test Impediment',
        projectId: 'proj-1',
        reportedById: 'user-1',
      };
      (mockDb.impediment.create as jest.Mock).mockResolvedValue(mockImp);
      // notifyScrumMasters → getProjectMembers → project.findUnique returns empty members
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({
        team: { members: [] },
      });

      const result = await service.create('user-1', {
        title: 'Test Impediment',
        projectId: 'proj-1',
      });

      expect(mockDb.impediment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Test Impediment' }),
        }),
      );
      expect(result).toBe(mockImp);
    });

    it('strips HTML tags from title (XSS protection)', async () => {
      const mockImp = {
        id: 'imp-2',
        title: 'xssTitle',
        projectId: 'proj-1',
        reportedById: 'user-1',
      };
      (mockDb.impediment.create as jest.Mock).mockResolvedValue(mockImp);
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({
        team: { members: [] },
      });

      await service.create('user-1', {
        title: '<script>xss</script>Title',
        projectId: 'proj-1',
      });

      const callArg = (mockDb.impediment.create as jest.Mock).mock.calls[0][0];
      // HTML tags are stripped but inner text content is preserved
      expect(callArg.data.title).not.toContain('<script>');
      expect(callArg.data.title).not.toContain('</script>');
      expect(callArg.data.title).toContain('Title');
    });
  });

  describe('updateStatus', () => {
    it('throws ValidationError for invalid status', async () => {
      await expect(
        service.updateStatus('imp-1', 'INVALID_STATUS'),
      ).rejects.toThrow('Invalid status: INVALID_STATUS');
    });

    it('throws ValidationError when resolving without comment', async () => {
      await expect(
        service.updateStatus('imp-1', 'RESOLVED', 'user-1', undefined),
      ).rejects.toThrow('Se requiere comentario de resolución');
    });

    it('happy path RESOLVED with comment', async () => {
      const mockImp = {
        id: 'imp-1',
        title: 'Test',
        status: 'RESOLVED',
        reportedById: 'user-1',
        projectId: 'proj-1',
      };
      (mockDb.impediment.update as jest.Mock).mockResolvedValue(mockImp);
      (mockDb.notification.create as jest.Mock).mockResolvedValue({ id: 'notif-1' });
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({
        team: { members: [] },
      });

      const result = await service.updateStatus('imp-1', 'RESOLVED', 'user-1', 'Issue fixed');

      expect(mockDb.impediment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RESOLVED',
            resolvedComment: 'Issue fixed',
          }),
        }),
      );
      expect(result).toBe(mockImp);
    });
  });

  describe('getImpediment', () => {
    it('throws NotFoundError when impediment not found', async () => {
      (mockDb.impediment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getImpediment('nonexistent-id')).rejects.toThrow(
        'Impediment no encontrado',
      );
    });
  });

  describe('escalateStaleImpediments', () => {
    it('marks stale impediments as escalated', async () => {
      const staleImp = {
        id: 'imp-stale',
        title: 'Stale Impediment',
        projectId: 'proj-1',
        status: 'OPEN',
        escalatedAt: null,
      };
      (mockDb.impediment.findMany as jest.Mock).mockResolvedValue([staleImp]);
      (mockDb.impediment.update as jest.Mock).mockResolvedValue({
        ...staleImp,
        escalatedAt: new Date(),
      });
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({
        team: { members: [] },
      });

      await service.escalateStaleImpediments();

      expect(mockDb.impediment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'imp-stale' },
          data: expect.objectContaining({ escalatedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
