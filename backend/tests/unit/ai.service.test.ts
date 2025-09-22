import { PrismaClient } from '@prisma/client';

// Must be defined before jest.mock() hoisting
const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { AiService } from '../../src/extensions/ai/ai.service';

const mockDb = {
  sprint: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  auditLog: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('AiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAcceptanceCriteria', () => {
    it('returns config message when no API key is available', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const service = new AiService(mockDb, null);
      const result = await service.generateAcceptanceCriteria('Login feature');

      expect(result).toContain('Configura tu API key');
      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it('returns AI text when client is available', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Given a user...\nWhen they login...\nThen they see the dashboard' }],
      });

      const service = new AiService(mockDb, 'test-key');
      const result = await service.generateAcceptanceCriteria('Login feature', 'User can log in');

      expect(result).toContain('Given a user');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('suggestStoryPoints', () => {
    it('returns 3 when no API key is available', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const service = new AiService(mockDb, null);
      const result = await service.suggestStoryPoints('New story', []);

      expect(result).toBe(3);
      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it('returns parsed number from AI response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '5' }],
      });

      const service = new AiService(mockDb, 'test-key');
      const result = await service.suggestStoryPoints('New story', [
        { title: 'Similar story', points: 5 },
      ]);

      expect(result).toBe(5);
    });
  });

  describe('detectSprintRisks', () => {
    it('returns [] when sprint not found', async () => {
      (mockDb.sprint.findUnique as jest.Mock).mockResolvedValue(null);

      const service = new AiService(mockDb, null);
      const result = await service.detectSprintRisks('nonexistent-sprint');

      expect(result).toEqual([]);
    });

    it('returns HIGH risk for empty sprint', async () => {
      (mockDb.sprint.findUnique as jest.Mock).mockResolvedValue({
        id: 'sprint-1',
        projectId: 'proj-1',
        userStories: [],
        endDate: null,
      });

      const service = new AiService(mockDb, null);
      const result = await service.detectSprintRisks('sprint-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: 'empty', severity: 'HIGH' });
    });

    it('returns HIGH risk when >30% stories are blocked', async () => {
      // 4 stories, 2 blocked = 50% blocked > 30%
      const stories = [
        { id: 's1', title: 'Story 1', status: 'IN_PROGRESS', isBlocked: true, points: 3, tasks: [] },
        { id: 's2', title: 'Story 2', status: 'IN_PROGRESS', isBlocked: true, points: 3, tasks: [] },
        { id: 's3', title: 'Story 3', status: 'TODO', isBlocked: false, points: 3, tasks: [] },
        { id: 's4', title: 'Story 4', status: 'TODO', isBlocked: false, points: 3, tasks: [] },
      ];
      (mockDb.sprint.findUnique as jest.Mock).mockResolvedValue({
        id: 'sprint-1',
        projectId: 'proj-1',
        userStories: stories,
        endDate: null,
      });
      (mockDb.auditLog.findFirst as jest.Mock).mockResolvedValue(null);
      (mockDb.sprint.findMany as jest.Mock).mockResolvedValue([]);

      const service = new AiService(mockDb, null);
      const result = await service.detectSprintRisks('sprint-1');

      const blockedRisk = result.find((r) => r.type === 'blocked');
      expect(blockedRisk).toBeDefined();
      expect(blockedRisk?.severity).toBe('HIGH');
    });
  });

  describe('generateDailySummary', () => {
    it('returns message when no active sprint', async () => {
      (mockDb.sprint.findFirst as jest.Mock).mockResolvedValue(null);

      const service = new AiService(mockDb, null);
      const result = await service.generateDailySummary('proj-1');

      expect(result).toBe('No hay sprint activo para este proyecto.');
    });
  });

  describe('suggestAutomationRules', () => {
    it('returns exactly 4 suggestions', async () => {
      const service = new AiService(mockDb, null);
      const result = await service.suggestAutomationRules('proj-1');

      expect(result).toHaveLength(4);
      expect(result[0]).toHaveProperty('trigger');
      expect(result[0]).toHaveProperty('action');
      expect(result[0]).toHaveProperty('description');
    });
  });
});
