import { UserStoryService } from '../../src/modules/user-story/user-story.service';
import { UserStoryRepository } from '../../src/modules/user-story/user-story.repository';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

// ── Mock data helpers ────────────────────────────────────────────────────────

function makeStory(overrides = {}) {
  return {
    id: 'story-1',
    title: 'Como usuario quiero iniciar sesión',
    description: null,
    epicId: null,
    projectId: 'project-1',
    sprintId: null,
    status: 'TODO',
    points: 3,
    priority: 'MEDIUM',
    assigneeId: null,
    order: 0,
    isBlocked: false,
    blockedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Mock DB ──────────────────────────────────────────────────────────────────

const mockDb = {
  project: { findUnique: jest.fn() },
  teamMember: { findUnique: jest.fn(), findMany: jest.fn() },
  notification: { create: jest.fn() },
  comment: { create: jest.fn() },
  user: { findUnique: jest.fn().mockResolvedValue(null) },
} as unknown as PrismaClient;

const mockRepo = {
  findMany: jest.fn(),
  findBacklog: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  reorder: jest.fn(),
} as unknown as UserStoryRepository;

const service = new UserStoryService(mockRepo, mockDb);

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupMember(role = 'PRODUCT_OWNER') {
  (mockDb.project.findUnique as jest.Mock).mockResolvedValue({ id: 'project-1', teamId: 'team-1' });
  (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1', teamId: 'team-1', role });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UserStoryService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getUserStory ───────────────────────────────────────────────────────────

  describe('getUserStory', () => {
    it('returns story when found', async () => {
      const story = makeStory();
      (mockRepo.findById as jest.Mock).mockResolvedValue(story);
      const result = await service.getUserStory('story-1');
      expect(result).toEqual(story);
    });

    it('throws NotFoundError when story does not exist', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.getUserStory('missing')).rejects.toThrow('Historia de usuario no encontrado');
    });
  });

  // ── createUserStory ────────────────────────────────────────────────────────

  describe('createUserStory', () => {
    it('creates story when user is a team member', async () => {
      setupMember('DEVELOPER');
      const story = makeStory();
      (mockRepo.create as jest.Mock).mockResolvedValue(story);

      const result = await service.createUserStory('user-1', {
        title: 'Como usuario quiero iniciar sesión',
        projectId: 'project-1',
      });

      expect(result.title).toBe('Como usuario quiero iniciar sesión');
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenError when user is not a member', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({ id: 'project-1', teamId: 'team-1' });
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createUserStory('outsider', { title: 'Test', projectId: 'project-1' }),
      ).rejects.toThrow('No eres miembro de este proyecto');
    });
  });

  // ── updateUserStory ────────────────────────────────────────────────────────

  describe('updateUserStory', () => {
    it('updates story fields for a member', async () => {
      setupMember('DEVELOPER');
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeStory());
      const updated = makeStory({ status: 'IN_PROGRESS' });
      (mockRepo.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateUserStory('user-1', 'story-1', { status: 'IN_PROGRESS' });
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('throws NotFoundError when story does not exist', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateUserStory('user-1', 'missing', { title: 'New' }),
      ).rejects.toThrow('Historia de usuario no encontrado');
    });
  });

  // ── deleteUserStory ────────────────────────────────────────────────────────

  describe('deleteUserStory', () => {
    it('deletes story when user is PO or SM', async () => {
      setupMember('PRODUCT_OWNER');
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeStory());
      (mockRepo.delete as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deleteUserStory('user-1', 'story-1');
      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith('story-1');
    });

    it('throws ForbiddenError when Developer tries to delete', async () => {
      setupMember('DEVELOPER');
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeStory());
      await expect(service.deleteUserStory('user-1', 'story-1')).rejects.toThrow(
        'Solo Product Owners y Scrum Masters',
      );
    });
  });

  // ── moveToSprint ───────────────────────────────────────────────────────────

  describe('moveToSprint', () => {
    it('moves story to sprint', async () => {
      setupMember('SCRUM_MASTER');
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeStory());
      const moved = makeStory({ sprintId: 'sprint-1' });
      (mockRepo.update as jest.Mock).mockResolvedValue(moved);

      const result = await service.moveToSprint('user-1', 'story-1', 'sprint-1');
      expect(result.sprintId).toBe('sprint-1');
    });

    it('moves story back to backlog when sprintId is null', async () => {
      setupMember('PRODUCT_OWNER');
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeStory({ sprintId: 'sprint-1' }));
      const backlogged = makeStory({ sprintId: null });
      (mockRepo.update as jest.Mock).mockResolvedValue(backlogged);

      const result = await service.moveToSprint('user-1', 'story-1', null);
      expect(result.sprintId).toBeNull();
    });
  });

  // ── blockStory ─────────────────────────────────────────────────────────────

  describe('blockStory', () => {
    beforeEach(() => {
      (mockDb.teamMember.findMany as jest.Mock).mockResolvedValue([
        { userId: 'sm-1', teamId: 'team-1', role: 'SCRUM_MASTER' },
      ]);
      (mockDb.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-1', userId: 'sm-1', type: 'STORY_BLOCKED', payload: '{}', readAt: null, createdAt: new Date(),
      });
    });

    it('marks story as blocked and notifies Scrum Masters', async () => {
      setupMember('DEVELOPER');
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeStory());
      const blocked = makeStory({ isBlocked: true, blockedReason: 'Falta API externa' });
      (mockRepo.update as jest.Mock).mockResolvedValue(blocked);

      const { story, smNotifications } = await service.blockStory('user-1', 'story-1', 'Falta API externa');

      expect(story.isBlocked).toBe(true);
      expect(story.blockedReason).toBe('Falta API externa');
      expect(mockRepo.update).toHaveBeenCalledWith('story-1', { isBlocked: true, blockedReason: 'Falta API externa' });
      expect(smNotifications).toHaveLength(1);
      expect(mockDb.notification.create).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError when story does not exist', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.blockStory('user-1', 'missing', 'reason')).rejects.toThrow('Historia de usuario no encontrado');
    });

    it('throws ForbiddenError when user is not a member', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({ id: 'project-1', teamId: 'team-1' });
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(null);
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeStory());
      await expect(service.blockStory('outsider', 'story-1', 'reason')).rejects.toThrow('No eres miembro');
    });
  });

  // ── unblockStory ───────────────────────────────────────────────────────────

  describe('unblockStory', () => {
    beforeEach(() => {
      (mockDb.comment.create as jest.Mock).mockResolvedValue({ id: 'comment-1' });
    });

    it('unblocks story and creates resolution comment', async () => {
      setupMember('DEVELOPER');
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeStory({ isBlocked: true, blockedReason: 'Falta API' }));
      const unblocked = makeStory({ isBlocked: false, blockedReason: null });
      (mockRepo.update as jest.Mock).mockResolvedValue(unblocked);

      const result = await service.unblockStory('user-1', 'story-1', 'Se resolvió la dependencia con la API');

      expect(result.isBlocked).toBe(false);
      expect(result.blockedReason).toBeNull();
      expect(mockDb.comment.create).toHaveBeenCalledWith({
        data: { body: 'Se resolvió la dependencia con la API', authorId: 'user-1', userStoryId: 'story-1' },
      });
      expect(mockRepo.update).toHaveBeenCalledWith('story-1', { isBlocked: false, blockedReason: null });
    });

    it('throws NotFoundError when story does not exist', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.unblockStory('user-1', 'missing', 'comment')).rejects.toThrow('Historia de usuario no encontrado');
    });

    it('throws ForbiddenError when user is not a member', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({ id: 'project-1', teamId: 'team-1' });
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(null);
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeStory({ isBlocked: true }));
      await expect(service.unblockStory('outsider', 'story-1', 'comment')).rejects.toThrow('No eres miembro');
    });
  });

  // ── reorderBacklog ─────────────────────────────────────────────────────────

  describe('reorderBacklog', () => {
    it('calls repo.reorder with correct args for PO', async () => {
      setupMember('PRODUCT_OWNER');
      const reordered = [makeStory({ order: 0 }), makeStory({ id: 'story-2', order: 1 })];
      (mockRepo.reorder as jest.Mock).mockResolvedValue(reordered);

      const result = await service.reorderBacklog('user-1', 'project-1', 'story-1', 1);

      expect(mockRepo.reorder).toHaveBeenCalledWith('project-1', 'story-1', 1, undefined);
      expect(result).toHaveLength(2);
    });

    it('throws ForbiddenError when user is a Developer', async () => {
      setupMember('DEVELOPER');
      await expect(service.reorderBacklog('user-1', 'project-1', 'story-1', 0)).rejects.toThrow(
        'Solo Product Owners y Scrum Masters',
      );
    });

    it('throws ForbiddenError when user is not a member', async () => {
      (mockDb.project.findUnique as jest.Mock).mockResolvedValue({ id: 'project-1', teamId: 'team-1' });
      (mockDb.teamMember.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.reorderBacklog('outsider', 'project-1', 'story-1', 0)).rejects.toThrow('No eres miembro');
    });
  });
});
