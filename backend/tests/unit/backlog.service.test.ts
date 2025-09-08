import { EpicService } from '../../src/modules/epic/epic.service';
import { EpicRepository } from '../../src/modules/epic/epic.repository';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

const mockDb = {
  epic: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  project: { findUnique: jest.fn() },
  teamMember: { findUnique: jest.fn() },
} as unknown as PrismaClient;

const mockRepo = {
  findByProject: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as unknown as EpicRepository;

const service = new EpicService(mockRepo, mockDb);

const baseProject = { id: 'proj-1', teamId: 'team-1' };
const baseEpic = {
  id: 'epic-1',
  title: 'Mi épica',
  description: null,
  projectId: 'proj-1',
  priority: 'MEDIUM',
  color: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const poMember = { userId: 'user-1', teamId: 'team-1', role: 'PRODUCT_OWNER' };
const devMember = { userId: 'user-2', teamId: 'team-1', role: 'DEVELOPER' };

describe('EpicService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getEpics', () => {
    it('returns epics from repo', async () => {
      (mockRepo.findByProject as jest.Mock).mockResolvedValue([baseEpic]);
      const result = await service.getEpics('proj-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('epic-1');
    });
  });

  describe('getEpic', () => {
    it('returns epic when found', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(baseEpic);
      const result = await service.getEpic('epic-1');
      expect(result.title).toBe('Mi épica');
    });

    it('throws NotFoundError when epic not found', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.getEpic('missing')).rejects.toThrow('Épica');
    });
  });

  describe('createEpic', () => {
    it('creates epic for Product Owner', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(poMember);
      (mockRepo.create as jest.Mock).mockResolvedValue(baseEpic);

      const result = await service.createEpic('user-1', {
        title: 'Mi épica',
        projectId: 'proj-1',
      });

      expect(result.id).toBe('epic-1');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Mi épica', projectId: 'proj-1' }),
      );
    });

    it('throws ForbiddenError for Developer role', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(devMember);

      await expect(
        service.createEpic('user-2', { title: 'Épica', projectId: 'proj-1' }),
      ).rejects.toThrow('Solo Product Owners y Scrum Masters');
    });

    it('throws ForbiddenError when user is not a team member', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createEpic('outsider', { title: 'Épica', projectId: 'proj-1' }),
      ).rejects.toThrow('No eres miembro de este proyecto');
    });

    it('throws NotFoundError when project does not exist', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createEpic('user-1', { title: 'Épica', projectId: 'ghost' }),
      ).rejects.toThrow('Proyecto');
    });
  });

  describe('updateEpic', () => {
    it('updates epic for authorized user', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(baseEpic);
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(poMember);
      (mockRepo.update as jest.Mock).mockResolvedValue({ ...baseEpic, title: 'Nuevo título' });

      const result = await service.updateEpic('user-1', 'epic-1', { title: 'Nuevo título' });
      expect(result.title).toBe('Nuevo título');
    });

    it('throws NotFoundError when epic does not exist', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.updateEpic('user-1', 'ghost', {})).rejects.toThrow('Épica');
    });
  });

  describe('deleteEpic', () => {
    it('deletes epic for Product Owner', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(baseEpic);
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(poMember);
      (mockRepo.delete as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deleteEpic('user-1', 'epic-1');
      expect(result).toBe(true);
    });

    it('throws ForbiddenError for Developer trying to delete', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(baseEpic);
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue(baseProject);
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(devMember);

      await expect(service.deleteEpic('user-2', 'epic-1')).rejects.toThrow(
        'Solo Product Owners y Scrum Masters',
      );
    });
  });
});
