/**
 * @file task.typedefs.ts
 * @module task
 * @description Definición del esquema GraphQL para el módulo de tareas.
 *
 * Una tarea es la unidad de trabajo más granular del sistema. Pertenece
 * a una historia de usuario y reutiliza el enum `StoryStatus` para
 * representar su estado (TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED).
 *
 * El campo `assignee` se resuelve como relación lazy al tipo `User`.
 * El campo `order` determina la posición visual de la tarea en la lista.
 *
 * Los inputs `CreateTaskInput` y `UpdateTaskInput` son estructuras separadas
 * para garantizar que los campos obligatorios solo se requieran en la creación.
 */
export const taskTypeDefs = `#graphql
  """
  Tarea atómica de trabajo dentro de una historia de usuario.
  """
  type Task {
    id: ID!
    title: String!
    description: String
    """ Historia de usuario a la que pertenece esta tarea. """
    userStoryId: String!
    """ Estado actual de la tarea (reutiliza el enum de historias). """
    status: StoryStatus!
    """ ID del usuario asignado para completar la tarea (puede ser null). """
    assigneeId: String
    dueDate: DateTime
    """ Posición visual de la tarea en la lista (0-indexed). """
    order: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    """ Usuario asignado, resuelto como relación lazy. """
    assignee: User
  }

  """
  Input para crear una nueva tarea. El userStoryId es obligatorio.
  """
  input CreateTaskInput {
    title: String!
    description: String
    userStoryId: ID!
    assigneeId: ID
    dueDate: DateTime
  }

  """
  Input para actualizar una tarea existente. Todos los campos son opcionales.
  """
  input UpdateTaskInput {
    title: String
    description: String
    status: StoryStatus
    assigneeId: ID
    dueDate: DateTime
    order: Int
  }

  extend type Query {
    """ Retorna todas las tareas de una historia de usuario ordenadas por posición. """
    tasks(userStoryId: ID!): [Task!]!
    """ Retorna una tarea específica por ID. """
    task(id: ID!): Task
  }

  extend type Mutation {
    """ Crea una nueva tarea en una historia de usuario. """
    createTask(input: CreateTaskInput!): Task!
    """ Actualiza los campos de una tarea existente. """
    updateTask(id: ID!, input: UpdateTaskInput!): Task!
    """ Elimina una tarea por su ID. """
    deleteTask(id: ID!): Boolean!
  }
`;
