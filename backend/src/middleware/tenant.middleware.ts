import { PrismaClient } from '@prisma/client';

/**
 * Resolves the workspace context for a given user and workspace slug.
 *
 * Returns the workspaceId if the user is an active member of the workspace
 * (i.e., has at least one TeamMember record in a team belonging to the workspace),
 * or null if the user is not a member or the workspace does not exist.
 */
export async function resolveTenantContext(
  userId: string,
  workspaceSlug: string | undefined,
  db: PrismaClient,
): Promise<string | null> {
  if (!workspaceSlug) {
    return null;
  }

  const workspace = await db.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true },
  });

  if (!workspace) {
    return null;
  }

  // Check membership: user must belong to at least one team in this workspace
  const membership = await db.teamMember.findFirst({
    where: {
      userId,
      team: {
        workspaceId: workspace.id,
      },
    },
    select: { id: true },
  });

  // Workspace owners always have access even without team membership
  if (!membership) {
    const isOwner = await db.workspace.findFirst({
      where: { id: workspace.id, ownerId: userId },
      select: { id: true },
    });
    if (!isOwner) {
      return null;
    }
  }

  return workspace.id;
}
