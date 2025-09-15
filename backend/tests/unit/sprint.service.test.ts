import { SprintService } from '../../src/modules/sprint/sprint.service';
import { SprintRepository } from '../../src/modules/sprint/sprint.repository';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

// ── Mock data helpers ────────────────────────────────────────────────────────

function makeSprint(overrides = {}) {
  return {
    id: 'sprint-1',
    name: 'Sprint 1',
    goal: null,
    projectId: 'project-1',
    startDate: null,
    endDate: null,
    status: 'PLANNING',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Mock DB ──────────────────────────────────────────────────────────────────

const mockDb = {
  project: { findUnique: jest.fn() },
  teamMember: { findUnique: jest.fn() },
  userStory: { findMany: jest.fn(), updateMany: jest.fn() },
  sprint: { findUnique: jest.fn() },
} as unknown as PrismaClient;

const mockRepo = {
  findByProject: jest.fn(),
  findById: jest.fn(),
  findActive: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as unknown as SprintRepository;

const service = new SprintService(mockRepo, mockDb);

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupCanManage(role = 'PRODUCT_OWNER') {
  (mockDb.project.findUnique as jest.Mock).mockResolvedValue({ id: 'project-1', teamId: 'team-1' });
  (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1', teamId: 'team-1', role });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SprintService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getSprint ──────────────────────────────────────────────────────────────

  describe('getSprint', () => {
    it('returns sprint when found', async () => {
      const sprint = makeSprint();
      (mockRepo.findById as jest.Mock).mockResolvedValue(sprint);
      const result = await service.getSprint('sprint-1');
      expect(result).toEqual(sprint);
    });

    it('throws NotFoundError when sprint does not exist', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.getSprint('missing')).rejects.toThrow('Sprint no encontrado');
    });
  });

  // ── createSprint ───────────────────────────────────────────────────────────

  describe('createSprint', () => {
    it('creates sprint when user is Product Owner', async () => {
      setupCanManage('PRODUCT_OWNER');
      const sprint = makeSprint({ name: 'Sprint 2' });
      (mockRepo.create as jest.Mock).mockResolvedValue(sprint);

      const result = await service.createSprint('user-1', {
        name: 'Sprint 2',
        projectId: 'project-1',
      });

      expect(result.name).toBe('Sprint 2');
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
    });

    it('creates sprint when user is Scrum Master', async () => {
      setupCanManage('SCRUM_MASTER');
      (mockRepo.create as jest.Mock).mockResolvedValue(makeSprint());
      await expect(
        service.createSprint('user-1', { name: 'Sprint 1', projectId: 'project-1' }),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenError when user is Developer', async () => {
      setupCanManage('DEVELOPER');
      await expect(
        service.createSprint('user-1', { name: 'Sprint 1', projectId: 'project-1' }),
      ).rejects.toThrow('Solo Product Owners y Scrum Masters');
    });
  });

  // ── startSprint ────────────────────────────────────────────────────────────

  describe('startSprint', () => {
    const input = {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    };

    it('starts a PLANNING sprint successfully', async () => {
      setupCanManage();
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeSprint({ status: 'PLANNING' }));
      (mockRepo.findActive as jest.Mock).mockResolvedValue(null);
      const started = makeSprint({ status: 'ACTIVE' });
      (mockRepo.update as jest.Mock).mockResolvedValue(started);

      const result = await service.startSprint('user-1', 'sprint-1', input);
      expect(result.status).toBe('ACTIVE');
    });

    it('throws ValidationError when sprint is already ACTIVE', async () => {
      setupCanManage();
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeSprint({ status: 'ACTIVE' }));
      await expect(service.startSprint('user-1', 'sprint-1', input)).rejects.toThrow(
        'Solo se pueden iniciar sprints en estado PLANNING',
      );
    });

    it('throws ValidationError when project already has an active sprint', async () => {
      setupCanManage();
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeSprint({ status: 'PLANNING' }));
      (mockRepo.findActive as jest.Mock).mockResolvedValue(makeSprint({ id: 'other', status: 'ACTIVE' }));
      await expect(service.startSprint('user-1', 'sprint-1', input)).rejects.toThrow(
        'Ya hay un sprint activo',
      );
    });
  });

  // ── completeSprint ─────────────────────────────────────────────────────────

  describe('completeSprint', () => {
    it('completes active sprint and moves incomplete stories to backlog', async () => {
      setupCanManage();
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeSprint({ status: 'ACTIVE' }));
      (mockDb.userStory.findMany as jest.Mock).mockResolvedValue([{ id: 'story-1' }]);
      (mockDb.userStory.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      const completed = makeSprint({ status: 'COMPLETED' });
      (mockRepo.update as jest.Mock).mockResolvedValue(completed);

      const result = await service.completeSprint('user-1', 'sprint-1');
      expect(result.status).toBe('COMPLETED');
      expect(mockDb.userStory.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['story-1'] } },
        data: { sprintId: null },
      });
    });

    it('throws ValidationError when sprint is not ACTIVE', async () => {
      setupCanManage();
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeSprint({ status: 'PLANNING' }));
      await expect(service.completeSprint('user-1', 'sprint-1')).rejects.toThrow(
        'Solo se pueden completar sprints activos',
      );
    });
  });

  // ── deleteSprint ───────────────────────────────────────────────────────────

  describe('deleteSprint', () => {
    it('deletes a PLANNING sprint and moves stories to backlog', async () => {
      setupCanManage();
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeSprint({ status: 'PLANNING' }));
      (mockDb.userStory.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockRepo.delete as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deleteSprint('user-1', 'sprint-1');
      expect(result).toBe(true);
    });

    it('throws ValidationError when trying to delete an ACTIVE sprint', async () => {
      setupCanManage();
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeSprint({ status: 'ACTIVE' }));
      await expect(service.deleteSprint('user-1', 'sprint-1')).rejects.toThrow(
        'No se puede eliminar un sprint activo',
      );
    });
  });
});
