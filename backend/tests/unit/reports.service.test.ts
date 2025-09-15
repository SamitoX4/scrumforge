import { ReportsService } from '../../src/modules/reports/reports.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

const mockDb = {
  sprint: { findUnique: jest.fn(), findMany: jest.fn() },
  userStory: { findMany: jest.fn() },
} as unknown as PrismaClient;

const service = new ReportsService(mockDb);

const baseSprint = {
  id: 'sprint-1',
  name: 'Sprint 1',
  projectId: 'proj-1',
  status: 'ACTIVE',
  startDate: new Date('2026-02-01'),
  endDate: new Date('2026-02-14'),
  goal: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ReportsService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getBurndownReport', () => {
    it('throws NotFoundError when sprint does not exist', async () => {
      (mockDb.sprint.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getBurndownReport('missing')).rejects.toThrow('Sprint');
    });

    it('throws ValidationError when sprint has no dates', async () => {
      (mockDb.sprint.findUnique as jest.Mock).mockResolvedValue({
        ...baseSprint,
        startDate: null,
        endDate: null,
      });
      await expect(service.getBurndownReport('sprint-1')).rejects.toThrow(
        'El sprint no tiene fechas definidas',
      );
    });

    it('returns burndown data for a sprint with stories', async () => {
      (mockDb.sprint.findUnique as jest.Mock).mockResolvedValue(baseSprint);
      (mockDb.userStory.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', points: 5, status: 'DONE' },
        { id: 's2', points: 3, status: 'IN_PROGRESS' },
        { id: 's3', points: 8, status: 'TODO' },
      ]);

      const result = await service.getBurndownReport('sprint-1');

      expect(result.sprint.id).toBe('sprint-1');
      expect(result.totalPoints).toBe(16);
      expect(Array.isArray(result.points)).toBe(true);
      expect(result.points.length).toBeGreaterThan(0);

      // Each point has required fields
      const first = result.points[0];
      expect(first).toHaveProperty('date');
      expect(first).toHaveProperty('remainingPoints');
      expect(first).toHaveProperty('idealPoints');
    });

    it('returns empty points array for sprint with no stories', async () => {
      (mockDb.sprint.findUnique as jest.Mock).mockResolvedValue(baseSprint);
      (mockDb.userStory.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getBurndownReport('sprint-1');
      expect(result.totalPoints).toBe(0);
      expect(result.points.every((p) => p.remainingPoints === 0)).toBe(true);
    });
  });

  describe('getVelocityReport', () => {
    it('returns empty velocity for project with no completed sprints', async () => {
      (mockDb.sprint.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getVelocityReport('proj-1');
      expect(result.sprints).toEqual([]);
      expect(result.averageVelocity).toBe(0);
    });

    it('calculates average velocity across completed sprints', async () => {
      // plannedPoints captured at close time
      (mockDb.sprint.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', name: 'Sprint 1', projectId: 'proj-1', status: 'COMPLETED', plannedPoints: 15 },
        { id: 's2', name: 'Sprint 2', projectId: 'proj-1', status: 'COMPLETED', plannedPoints: 10 },
      ]);
      // getVelocityReport queries only DONE stories per sprint
      (mockDb.userStory.findMany as jest.Mock)
        .mockResolvedValueOnce([{ points: 10, status: 'DONE' }])  // s1 completed
        .mockResolvedValueOnce([{ points: 8, status: 'DONE' }, { points: 2, status: 'DONE' }]); // s2 completed

      const result = await service.getVelocityReport('proj-1');

      expect(result.projectId).toBe('proj-1');
      expect(result.sprints).toHaveLength(2);
      // After .reverse(): sprints[0]=s2, sprints[1]=s1
      expect(result.sprints[0].completedPoints).toBe(10); // s2
      expect(result.sprints[0].plannedPoints).toBe(10);
      expect(result.sprints[1].completedPoints).toBe(10); // s1
      expect(result.sprints[1].plannedPoints).toBe(15);
      expect(result.averageVelocity).toBe(10);
    });

    it('respects lastSprints limit', async () => {
      (mockDb.sprint.findMany as jest.Mock).mockResolvedValue([]);
      await service.getVelocityReport('proj-1', 3);
      expect(mockDb.sprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
    });
  });
});
