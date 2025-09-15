import { TeamService } from '../../src/modules/team/team.service';
import { TeamRepository } from '../../src/modules/team/team.repository';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

function makeMember(overrides = {}) {
  return {
    userId: 'user-1',
    teamId: 'team-1',
    role: 'PRODUCT_OWNER',
    joinedAt: new Date(),
    ...overrides,
  };
}

const mockDb = {
  user: { findUnique: jest.fn() },
  teamMember: { findMany: jest.fn() },
} as unknown as PrismaClient;

const mockRepo = {
  findById: jest.fn(),
  findTeamsForUser: jest.fn(),
  create: jest.fn(),
  getMember: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
  updateMemberRole: jest.fn(),
} as unknown as TeamRepository;

const service = new TeamService(mockRepo, mockDb);

describe('TeamService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── removeMember ────────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('removes member when team has more than one PO', async () => {
      // requester is PO
      (mockRepo.getMember as jest.Mock)
        .mockResolvedValueOnce(makeMember()) // checkCanManageTeam call
        .mockResolvedValueOnce(makeMember()); // member to remove
      (mockDb.teamMember.findMany as jest.Mock).mockResolvedValue([
        makeMember({ userId: 'user-1' }),
        makeMember({ userId: 'user-2' }), // another PO remains
      ]);
      (mockRepo.removeMember as jest.Mock).mockResolvedValue(undefined);

      const result = await service.removeMember('user-1', 'team-1', 'user-1');
      expect(result).toBe(true);
      expect(mockRepo.removeMember).toHaveBeenCalledWith('team-1', 'user-1');
    });

    it('throws ForbiddenError when removing the last PO', async () => {
      (mockRepo.getMember as jest.Mock)
        .mockResolvedValueOnce(makeMember()) // checkCanManageTeam
        .mockResolvedValueOnce(makeMember()); // member to remove
      (mockDb.teamMember.findMany as jest.Mock).mockResolvedValue([
        makeMember({ userId: 'user-1' }), // only one PO
      ]);

      await expect(service.removeMember('user-1', 'team-1', 'user-1')).rejects.toThrow(
        'Debe haber al menos un Product Owner',
      );
      expect(mockRepo.removeMember).not.toHaveBeenCalled();
    });

    it('removes a non-PO member without checking PO count', async () => {
      (mockRepo.getMember as jest.Mock)
        .mockResolvedValueOnce(makeMember()) // checkCanManageTeam
        .mockResolvedValueOnce(makeMember({ userId: 'dev-1', role: 'DEVELOPER' }));
      (mockRepo.removeMember as jest.Mock).mockResolvedValue(undefined);

      const result = await service.removeMember('user-1', 'team-1', 'dev-1');
      expect(result).toBe(true);
      expect(mockDb.teamMember.findMany).not.toHaveBeenCalled();
    });
  });

  // ── updateMemberRole ────────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    it('updates role when the team still has another PO', async () => {
      (mockRepo.getMember as jest.Mock)
        .mockResolvedValueOnce(makeMember()) // checkCanManageTeam
        .mockResolvedValueOnce(makeMember()); // member to update
      (mockDb.teamMember.findMany as jest.Mock).mockResolvedValue([
        makeMember({ userId: 'user-1' }),
        makeMember({ userId: 'user-2' }),
      ]);
      const updated = makeMember({ role: 'SCRUM_MASTER' });
      (mockRepo.updateMemberRole as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateMemberRole('user-1', 'team-1', 'user-1', 'SCRUM_MASTER');
      expect(result.role).toBe('SCRUM_MASTER');
    });

    it('throws ForbiddenError when demoting the last PO', async () => {
      (mockRepo.getMember as jest.Mock)
        .mockResolvedValueOnce(makeMember()) // checkCanManageTeam
        .mockResolvedValueOnce(makeMember()); // member to update
      (mockDb.teamMember.findMany as jest.Mock).mockResolvedValue([
        makeMember({ userId: 'user-1' }), // only one PO
      ]);

      await expect(
        service.updateMemberRole('user-1', 'team-1', 'user-1', 'DEVELOPER'),
      ).rejects.toThrow('Debe haber al menos un Product Owner');
      expect(mockRepo.updateMemberRole).not.toHaveBeenCalled();
    });

    it('allows updating a non-PO role without checking PO count', async () => {
      (mockRepo.getMember as jest.Mock)
        .mockResolvedValueOnce(makeMember()) // checkCanManageTeam
        .mockResolvedValueOnce(makeMember({ userId: 'dev-1', role: 'DEVELOPER' }));
      const updated = makeMember({ userId: 'dev-1', role: 'SCRUM_MASTER' });
      (mockRepo.updateMemberRole as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateMemberRole('user-1', 'team-1', 'dev-1', 'SCRUM_MASTER');
      expect(result.role).toBe('SCRUM_MASTER');
      expect(mockDb.teamMember.findMany).not.toHaveBeenCalled();
    });
  });
});
