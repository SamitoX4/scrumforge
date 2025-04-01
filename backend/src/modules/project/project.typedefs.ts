/**
 * @file project.typedefs.ts
 * @description Definiciones del esquema GraphQL para el módulo de proyectos.
 *
 * Un proyecto pertenece a un equipo y contiene épicas y sprints.
 * La clave (`key`) es un identificador corto en mayúsculas único dentro del equipo
 * que se usa como prefijo en los identificadores de historias de usuario (p. ej. `PRJ-42`).
 *
 * El campo `settings` almacena configuración flexible del proyecto como JSON serializado,
 * lo que permite añadir opciones sin migraciones de esquema.
 */
export const projectTypeDefs = `#graphql
  """
  Proyecto de desarrollo dentro de un equipo de ScrumForge.
  Contiene épicas que agrupan historias de usuario y sprints para planificación iterativa.
  """
  type Project {
    id: ID!
    "Nombre visible del proyecto."
    name: String!
    "Clave corta en mayúsculas única dentro del equipo (p. ej. 'PRJ'). Se usa como prefijo en los identificadores de historias."
    key: String!
    "ID del equipo al que pertenece el proyecto."
    teamId: String!
    "Configuración del proyecto serializada como JSON."
    settings: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    "Equipo propietario del proyecto."
    team: Team!
    "Lista de épicas del proyecto, ordenadas por su campo 'order'."
    epics: [Epic!]!
    "Lista de sprints del proyecto, ordenados por fecha de creación descendente."
    sprints: [Sprint!]!
  }

  "Datos requeridos para crear un nuevo proyecto."
  input CreateProjectInput {
    name: String!
    "Clave corta del proyecto. Se normaliza a mayúsculas automáticamente."
    key: String!
    "ID del equipo al que pertenecerá el proyecto."
    teamId: ID!
  }

  extend type Query {
    "Devuelve un proyecto por su ID."
    project(id: ID!): Project
    "Devuelve todos los proyectos de un equipo."
    projects(teamId: ID!): [Project!]!
  }

  extend type Mutation {
    "Crea un nuevo proyecto en el equipo indicado. Requiere rol PRODUCT_OWNER o SCRUM_MASTER."
    createProject(input: CreateProjectInput!): Project!
    "Actualiza el nombre y/o la configuración de un proyecto. Requiere rol PRODUCT_OWNER o SCRUM_MASTER."
    updateProject(id: ID!, name: String, settings: String): Project!
    "Elimina el proyecto y todos sus datos en cascada. Requiere rol PRODUCT_OWNER o SCRUM_MASTER."
    deleteProject(id: ID!): Boolean!
  }
`;
