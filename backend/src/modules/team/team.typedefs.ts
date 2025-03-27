/**
 * @file team.typedefs.ts
 * @description Definiciones del esquema GraphQL para el módulo de equipos.
 *
 * Un equipo pertenece a un workspace y contiene miembros con roles diferenciados.
 * Los roles (`TeamRole`) determinan qué operaciones puede realizar cada miembro:
 * - PRODUCT_OWNER: gestiona el backlog y tiene control total sobre el equipo.
 * - SCRUM_MASTER: facilita el proceso Scrum y puede gestionar miembros.
 * - DEVELOPER: accede al tablero y ejecuta tareas.
 * - STAKEHOLDER: solo lectura, seguimiento del progreso.
 *
 * La mutación `inviteMember` se gestiona a través del módulo `workspace-invitation`
 * con un flujo de correo electrónico, por lo que no aparece aquí directamente.
 */
export const teamTypeDefs = `#graphql
  """
  Equipo de trabajo dentro de un workspace.
  Agrupa miembros con roles específicos y proyectos de desarrollo.
  """
  type Team {
    id: ID!
    "Nombre visible del equipo."
    name: String!
    "ID del workspace al que pertenece el equipo."
    workspaceId: String!
    createdAt: DateTime!
    "Lista de membresías del equipo con sus roles."
    members: [TeamMember!]!
    "Lista de proyectos gestionados por el equipo."
    projects: [Project!]!
  }

  """
  Membresía de un usuario en un equipo.
  Contiene el rol asignado y la fecha de incorporación.
  """
  type TeamMember {
    id: ID!
    "ID del usuario miembro."
    userId: String!
    "ID del equipo al que pertenece la membresía."
    teamId: String!
    "Rol del usuario en el equipo."
    role: TeamRole!
    "Fecha en que el usuario se unió al equipo."
    joinedAt: DateTime!
    "Datos del usuario asociado a esta membresía."
    user: User!
  }

  """
  Roles disponibles dentro de un equipo de ScrumForge.
  Determinan los permisos de cada miembro sobre proyectos, sprints y tableros.
  """
  enum TeamRole {
    "Propietario del producto. Gestiona el backlog y tiene control total sobre el equipo."
    PRODUCT_OWNER
    "Facilita el proceso Scrum. Puede gestionar miembros y configurar sprints."
    SCRUM_MASTER
    "Desarrollador del equipo. Accede al tablero y ejecuta tareas asignadas."
    DEVELOPER
    "Partes interesadas con acceso de solo lectura para seguimiento del progreso."
    STAKEHOLDER
  }

  "Datos requeridos para crear un nuevo equipo."
  input CreateTeamInput {
    name: String!
    "ID del workspace al que pertenecerá el equipo."
    workspaceId: ID!
  }

  "Datos requeridos para invitar a un miembro al equipo."
  input InviteMemberInput {
    teamId: ID!
    "Correo electrónico del usuario a invitar."
    email: String!
    "Rol que tendrá el usuario en el equipo."
    role: TeamRole!
  }

  extend type Query {
    "Devuelve un equipo por su ID."
    team(id: ID!): Team
    "Devuelve los equipos del workspace en los que participa el usuario autenticado."
    myTeams(workspaceId: ID!): [Team!]!
  }

  extend type Mutation {
    "Crea un nuevo equipo. El creador se añade automáticamente como SCRUM_MASTER."
    createTeam(input: CreateTeamInput!): Team!
    "Elimina a un usuario del equipo. Requiere rol PRODUCT_OWNER o SCRUM_MASTER."
    removeMember(teamId: ID!, userId: ID!): Boolean!
    "Cambia el rol de un miembro del equipo. Requiere rol PRODUCT_OWNER o SCRUM_MASTER."
    updateMemberRole(teamId: ID!, userId: ID!, role: TeamRole!): TeamMember!
  }
`;
