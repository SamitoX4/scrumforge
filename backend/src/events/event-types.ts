/** Enum de todos los tipos de eventos del dominio (Event Sourcing). */
export enum EventType {
  // Sprint lifecycle
  SPRINT_CREATED               = 'SPRINT_CREATED',
  SPRINT_STARTED               = 'SPRINT_STARTED',
  SPRINT_COMPLETED             = 'SPRINT_COMPLETED',
  SPRINT_DELETED               = 'SPRINT_DELETED',

  // User Story
  USER_STORY_CREATED           = 'USER_STORY_CREATED',
  USER_STORY_UPDATED           = 'USER_STORY_UPDATED',
  USER_STORY_STATUS_CHANGED    = 'USER_STORY_STATUS_CHANGED',
  USER_STORY_MOVED_TO_SPRINT   = 'USER_STORY_MOVED_TO_SPRINT',
  USER_STORY_DELETED           = 'USER_STORY_DELETED',

  // Epic
  EPIC_CREATED                 = 'EPIC_CREATED',
  EPIC_UPDATED                 = 'EPIC_UPDATED',
  EPIC_DELETED                 = 'EPIC_DELETED',

  // Task
  TASK_CREATED                 = 'TASK_CREATED',
  TASK_UPDATED                 = 'TASK_UPDATED',
  TASK_STATUS_CHANGED          = 'TASK_STATUS_CHANGED',
  TASK_DELETED                 = 'TASK_DELETED',

  // Board
  BOARD_COLUMNS_UPDATED        = 'BOARD_COLUMNS_UPDATED',
  TASK_MOVED_ON_BOARD          = 'TASK_MOVED_ON_BOARD',

  // Team & membership
  MEMBER_INVITED               = 'MEMBER_INVITED',
  MEMBER_REMOVED               = 'MEMBER_REMOVED',
  MEMBER_ROLE_CHANGED          = 'MEMBER_ROLE_CHANGED',

  // Project
  PROJECT_CREATED              = 'PROJECT_CREATED',
  PROJECT_UPDATED              = 'PROJECT_UPDATED',

  // Workspace
  WORKSPACE_DELETED            = 'WORKSPACE_DELETED',
}

/** Tipo del agregado al que pertenece el evento. */
export enum AggregateType {
  SPRINT       = 'SPRINT',
  USER_STORY   = 'USER_STORY',
  EPIC         = 'EPIC',
  TASK         = 'TASK',
  PROJECT      = 'PROJECT',
  TEAM         = 'TEAM',
  BOARD        = 'BOARD',
  WORKSPACE    = 'WORKSPACE',
}
