import { PrismaClient } from '@prisma/client';
import { resolveTenantContext } from '../../src/middleware/tenant.middleware';

jest.mock('@prisma/client');

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const WS_A = { id: 'ws-a', slug: 'acme', ownerId: 'owner-a' };
const WS_B = { id: 'ws-b', slug: 'rival', ownerId: 'owner-b' };

const MEMBER_OF_A = 'user-member-a';   // team member in workspace A
const OWNER_OF_A  = 'owner-a';         // workspace owner of A (no team row needed)
const STRANGER    = 'user-stranger';   // has no relationship to either workspace

// ─── Mock DB ───────────────────────────────────────────────────────────────────

const mockDb = {
  workspace: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  teamMember: {
    findFirst: jest.fn(),
  },
} as unknown as PrismaClient;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Simulates workspace A being found, and user has team membership in it */
function setupMemberAccess() {
  (mockDb.workspace.findUnique as jest.Mock).mockResolvedValue({ id: WS_A.id });
  (mockDb.teamMember.findFirst as jest.Mock).mockResolvedValue({ id: 'tm-1' });
}

/** Simulates workspace A being found, user has NO team membership, but IS owner */
function setupOwnerAccess() {
  (mockDb.workspace.findUnique as jest.Mock).mockResolvedValue({ id: WS_A.id });
  (mockDb.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
  (mockDb.workspace.findFirst as jest.Mock).mockResolvedValue({ id: WS_A.id });
}

/** Simulates workspace A found, user has no membership and is NOT owner */
function setupNoAccess() {
  (mockDb.workspace.findUnique as jest.Mock).mockResolvedValue({ id: WS_A.id });
  (mockDb.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
  (mockDb.workspace.findFirst as jest.Mock).mockResolvedValue(null);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveTenantContext — tenant isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Preconditions ─────────────────────────────────────────────────────────

  describe('preconditions', () => {
    it('returns null when no workspace slug is provided', async () => {
      const result = await resolveTenantContext(MEMBER_OF_A, undefined, mockDb);
      expect(result).toBeNull();
      expect(mockDb.workspace.findUnique).not.toHaveBeenCalled();
    });

    it('returns null when the workspace slug does not exist', async () => {
      (mockDb.workspace.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await resolveTenantContext(MEMBER_OF_A, 'nonexistent', mockDb);
      expect(result).toBeNull();
    });
  });

  // ── Access granted ────────────────────────────────────────────────────────

  describe('access granted', () => {
    it('returns workspaceId for a team member', async () => {
      setupMemberAccess();
      const result = await resolveTenantContext(MEMBER_OF_A, WS_A.slug, mockDb);
      expect(result).toBe(WS_A.id);
    });

    it('returns workspaceId for the workspace owner even without a team row', async () => {
      setupOwnerAccess();
      const result = await resolveTenantContext(OWNER_OF_A, WS_A.slug, mockDb);
      expect(result).toBe(WS_A.id);
    });
  });

  // ── Access denied ─────────────────────────────────────────────────────────

  describe('access denied', () => {
    it('returns null for a user with no membership and not the owner', async () => {
      setupNoAccess();
      const result = await resolveTenantContext(STRANGER, WS_A.slug, mockDb);
      expect(result).toBeNull();
    });

    it('denies workspace B access to a member of workspace A', async () => {
      // Workspace B exists but MEMBER_OF_A has no membership there
      (mockDb.workspace.findUnique as jest.Mock).mockResolvedValue({ id: WS_B.id });
      (mockDb.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
      (mockDb.workspace.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await resolveTenantContext(MEMBER_OF_A, WS_B.slug, mockDb);
      expect(result).toBeNull();
    });

    it('owner of workspace A cannot resolve workspace B as tenant', async () => {
      // OWNER_OF_A tries to access WS_B — not a member, not the owner
      (mockDb.workspace.findUnique as jest.Mock).mockResolvedValue({ id: WS_B.id });
      (mockDb.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
      (mockDb.workspace.findFirst as jest.Mock).mockResolvedValue(null); // not owner of B

      const result = await resolveTenantContext(OWNER_OF_A, WS_B.slug, mockDb);
      expect(result).toBeNull();
    });
  });

  // ── Membership check correctness ──────────────────────────────────────────

  describe('membership check scope', () => {
    it('queries teamMember with correct workspaceId scope', async () => {
      setupMemberAccess();
      await resolveTenantContext(MEMBER_OF_A, WS_A.slug, mockDb);

      expect(mockDb.teamMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: MEMBER_OF_A,
            team: expect.objectContaining({ workspaceId: WS_A.id }),
          }),
        }),
      );
    });

    it('does not skip ownership check when team membership is absent', async () => {
      setupOwnerAccess();
      await resolveTenantContext(OWNER_OF_A, WS_A.slug, mockDb);

      // Must have checked ownership after missing team membership
      expect(mockDb.workspace.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: WS_A.id, ownerId: OWNER_OF_A }),
        }),
      );
    });
  });
});
