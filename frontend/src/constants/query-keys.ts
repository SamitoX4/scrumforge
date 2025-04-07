/**
 * Nombres canónicos de las queries de Apollo — usar en refetchQueries para
 * invalidar el cache de forma consistente en toda la aplicación.
 */
export const QUERY_KEYS = {
  // Auth
  ME: 'Me',

  // Project
  GET_PROJECT: 'GetProject',
  GET_PROJECT_SETTINGS: 'GetProjectSettings',
  GET_PROJECTS: 'GetProjects',

  // Backlog
  GET_EPICS: 'GetEpics',
  GET_BACKLOG: 'GetBacklog',
  GET_USER_STORY: 'GetUserStory',

  // Sprint
  GET_SPRINTS: 'GetSprints',
  GET_ACTIVE_SPRINT: 'GetActiveSprint',

  // Board
  GET_BOARD_COLUMNS: 'GetBoardColumns',

  // Reports
  GET_BURNDOWN: 'GetBurndown',
  GET_VELOCITY: 'GetVelocity',

  // Comments
  GET_COMMENTS: 'GetComments',

  // Team
  GET_TEAM: 'GetTeam',

  // Workspace
  GET_WORKSPACES: 'GetWorkspaces',
  GET_WORKSPACE: 'GetWorkspace',

  // Notifications
  GET_NOTIFICATIONS: 'GetNotifications',
  GET_UNREAD_COUNT: 'GetUnreadNotificationCount',
} as const;

export type QueryKey = (typeof QUERY_KEYS)[keyof typeof QUERY_KEYS];
