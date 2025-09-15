import { RetroService } from '../../src/modules/retrospective/retro.service';
import { PrismaClient } from '@prisma/client';

jest.mock('../../src/realtime/pubsub', () => ({
  pubsub: { publish: jest.fn().mockResolvedValue(undefined) },
  RETRO_UPDATED_CHANNEL: (id: string) => 'RETRO_UPDATED_' + id,
}));

const mockDb = {
  retrospective: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  retroCard: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  retroAction: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

const service = new RetroService(mockDb);

// A valid retro object returned by retroWithDetails
const baseRetro = {
  id: 'retro-1',
  projectId: 'proj-1',
  title: 'Sprint 1 Retro',
  template: 'START_STOP_CONTINUE',
  status: 'OPEN',
  cards: [],
  actions: [],
};

describe('RetroService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('calls db.retrospective.create with correct fields', async () => {
      (mockDb.retrospective.create as jest.Mock).mockResolvedValue(baseRetro);

      const result = await service.create('proj-1', 'Sprint 1 Retro', 'START_STOP_CONTINUE', 'sprint-1', 'user-1');

      expect(mockDb.retrospective.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            title: 'Sprint 1 Retro',
            template: 'START_STOP_CONTINUE',
            sprintId: 'sprint-1',
            createdById: 'user-1',
            status: 'OPEN',
          }),
        }),
      );
      expect(result).toBe(baseRetro);
    });
  });

  describe('addCard', () => {
    it('sanitizes body, creates card, and publishes update', async () => {
      (mockDb.retroCard.create as jest.Mock).mockResolvedValue({});
      (mockDb.retrospective.findUnique as jest.Mock).mockResolvedValue(baseRetro);

      const result = await service.addCard('retro-1', 'START', '<b>Good teamwork</b>', 'user-1');

      const createCall = (mockDb.retroCard.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.body).not.toContain('<b>');
      expect(createCall.data.body).toBe('Good teamwork');
      expect(mockDb.retrospective.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'retro-1' } }),
      );
      expect(result).toBe(baseRetro);
    });
  });

  describe('deleteCard', () => {
    it('throws NotFoundError when card not found', async () => {
      (mockDb.retroCard.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteCard('nonexistent-card')).rejects.toThrow(
        'RetroCard no encontrado',
      );
    });
  });

  describe('voteCard', () => {
    it('increments votes by 1', async () => {
      const updatedCard = { id: 'card-1', retroId: 'retro-1', votes: 3, author: null };
      (mockDb.retroCard.update as jest.Mock).mockResolvedValue(updatedCard);
      (mockDb.retrospective.findUnique as jest.Mock).mockResolvedValue(baseRetro);

      const result = await service.voteCard('card-1');

      expect(mockDb.retroCard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'card-1' },
          data: { votes: { increment: 1 } },
        }),
      );
      expect(result).toBe(updatedCard);
    });
  });

  describe('addAction', () => {
    it('sanitizes title, creates action, and publishes update', async () => {
      (mockDb.retroAction.create as jest.Mock).mockResolvedValue({});
      (mockDb.retrospective.findUnique as jest.Mock).mockResolvedValue(baseRetro);

      await service.addAction('retro-1', '<script>alert(1)</script>Fix CI', 'user-1');

      const createCall = (mockDb.retroAction.create as jest.Mock).mock.calls[0][0];
      // HTML tags are stripped; inner text content is preserved
      expect(createCall.data.title).not.toContain('<script>');
      expect(createCall.data.title).not.toContain('</script>');
      expect(createCall.data.title).toContain('Fix CI');
      expect(mockDb.retrospective.findUnique).toHaveBeenCalled();
    });
  });

  describe('toggleAction', () => {
    it('throws NotFoundError when action not found', async () => {
      (mockDb.retroAction.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.toggleAction('nonexistent-action')).rejects.toThrow(
        'RetroAction no encontrado',
      );
    });

    it('toggles done from false to true', async () => {
      const action = { id: 'action-1', retroId: 'retro-1', done: false };
      const updatedAction = { ...action, done: true, assignedTo: null };
      (mockDb.retroAction.findUnique as jest.Mock).mockResolvedValue(action);
      (mockDb.retroAction.update as jest.Mock).mockResolvedValue(updatedAction);
      (mockDb.retrospective.findUnique as jest.Mock).mockResolvedValue(baseRetro);

      const result = await service.toggleAction('action-1');

      expect(mockDb.retroAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'action-1' },
          data: { done: true },
        }),
      );
      expect(result).toBe(updatedAction);
    });
  });

  describe('close', () => {
    it('updates status to CLOSED', async () => {
      (mockDb.retrospective.update as jest.Mock).mockResolvedValue({});
      (mockDb.retrospective.findUnique as jest.Mock).mockResolvedValue({
        ...baseRetro,
        status: 'CLOSED',
      });

      const result = await service.close('retro-1');

      expect(mockDb.retrospective.update).toHaveBeenCalledWith({
        where: { id: 'retro-1' },
        data: { status: 'CLOSED' },
      });
      expect(result.status).toBe('CLOSED');
    });
  });
});
