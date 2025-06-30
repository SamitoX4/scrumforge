/**
 * Compares old and new story fields and returns an array of audit log payloads.
 * Skips internal tracking fields (updatedAt, order, etc.).
 */
export function diffStoryFields(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  projectId: string,
  userId: string,
  entityId: string,
): Array<{
  entityType: string;
  entityId: string;
  action: 'STATUS_CHANGED' | 'FIELD_UPDATED' | 'ASSIGNED';
  field: string;
  oldValue: string;
  newValue: string;
  userId: string;
  projectId: string;
}> {
  const TRACKED = ['status', 'title', 'description', 'priority', 'points', 'assigneeId', 'epicId', 'sprintId'];
  const result: Array<{
    entityType: string;
    entityId: string;
    action: 'STATUS_CHANGED' | 'FIELD_UPDATED' | 'ASSIGNED';
    field: string;
    oldValue: string;
    newValue: string;
    userId: string;
    projectId: string;
  }> = [];
  for (const field of TRACKED) {
    if (field in newData && String(oldData[field] ?? '') !== String(newData[field] ?? '')) {
      const action = field === 'status' ? 'STATUS_CHANGED' : field === 'assigneeId' ? 'ASSIGNED' : 'FIELD_UPDATED';
      result.push({
        entityType: 'UserStory',
        entityId,
        action,
        field,
        oldValue: String(oldData[field] ?? ''),
        newValue: String(newData[field] ?? ''),
        userId,
        projectId,
      });
    }
  }
  return result;
}
