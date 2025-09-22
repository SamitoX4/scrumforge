import { DependencyService } from '../../src/modules/dependencies/dependency.service';
import { PrismaClient } from '@prisma/client';

const mockDb = {
  storyDependency: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaClient;

const service = new DependencyService(mockDb);

describe('DependencyService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('add', () => {
    it('throws ValidationError for invalid dependency type', async () => {
      await expect(
        service.add('story-1', 'story-2', 'INVALID', 'user-1'),
      ).rejects.toThrow('Tipo inválido: INVALID');
    });

    it('throws ValidationError when fromStoryId equals toStoryId', async () => {
      await expect(
        service.add('story-1', 'story-1', 'BLOCKS', 'user-1'),
      ).rejects.toThrow('Una historia no puede depender de sí misma');
    });

    it('happy path with valid type BLOCKS', async () => {
      const mockDependency = {
        id: 'dep-1',
        fromStoryId: 'story-1',
        toStoryId: 'story-2',
        type: 'BLOCKS',
        createdById: 'user-1',
        fromStory: { id: 'story-1', title: 'Story 1', status: 'TODO' },
        toStory: { id: 'story-2', title: 'Story 2', status: 'TODO' },
      };
      (mockDb.storyDependency.create as jest.Mock).mockResolvedValue(mockDependency);

      const result = await service.add('story-1', 'story-2', 'BLOCKS', 'user-1');

      expect(mockDb.storyDependency.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { fromStoryId: 'story-1', toStoryId: 'story-2', type: 'BLOCKS', createdById: 'user-1' },
        }),
      );
      expect(result).toBe(mockDependency);
    });
  });

  describe('remove', () => {
    it('calls db.storyDependency.delete and returns true', async () => {
      (mockDb.storyDependency.delete as jest.Mock).mockResolvedValue({});

      const result = await service.remove('dep-1');

      expect(mockDb.storyDependency.delete).toHaveBeenCalledWith({ where: { id: 'dep-1' } });
      expect(result).toBe(true);
    });
  });

  describe('getBlockers', () => {
    it('returns only IDs of non-DONE stories', async () => {
      const mockDeps = [
        { toStory: { id: 'story-blocker-1', status: 'IN_PROGRESS' } },
        { toStory: { id: 'story-done', status: 'DONE' } },
        { toStory: { id: 'story-blocker-2', status: 'TODO' } },
      ];
      (mockDb.storyDependency.findMany as jest.Mock).mockResolvedValue(mockDeps);

      const result = await service.getBlockers('story-1');

      expect(result).toEqual(['story-blocker-1', 'story-blocker-2']);
      expect(result).not.toContain('story-done');
    });
  });

  describe('getForStory', () => {
    it('calls findMany with correct OR filter', async () => {
      (mockDb.storyDependency.findMany as jest.Mock).mockResolvedValue([]);

      await service.getForStory('story-1');

      expect(mockDb.storyDependency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ fromStoryId: 'story-1' }, { toStoryId: 'story-1' }],
          },
        }),
      );
    });
  });
});
