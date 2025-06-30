/**
 * @file dod.typedefs.ts
 * @module definition-of-done
 * @description Definición del esquema GraphQL para el módulo de Definition of Done.
 *
 * Define el tipo `DodItem` que representa un criterio de completitud
 * de un proyecto, y extiende los tipos `Query` y `Mutation` con las
 * operaciones CRUD y de reordenamiento.
 *
 * El campo `order` es un entero que determina la posición visual del ítem
 * en la lista; se gestiona automáticamente en el servicio durante la creación
 * y puede modificarse manualmente mediante `reorderDodItems`.
 */
export const dodTypeDefs = `#graphql
  """
  Ítem de la Definition of Done de un proyecto.
  Representa un criterio de calidad que una historia debe cumplir
  para considerarse terminada.
  """
  type DodItem {
    id:        ID!
    """ Texto descriptivo del criterio de completitud. """
    text:      String!
    projectId: String!
    """ Posición del ítem en la lista (0-indexed, orden ascendente). """
    order:     Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  extend type Query {
    """ Retorna todos los ítems DoD de un proyecto, ordenados por posición. """
    dodItems(projectId: ID!): [DodItem!]!
  }

  extend type Mutation {
    """ Crea un nuevo criterio al final de la lista DoD del proyecto. """
    createDodItem(projectId: ID!, text: String!): DodItem!
    """ Actualiza el texto de un ítem DoD existente. """
    updateDodItem(id: ID!, text: String): DodItem!
    """ Elimina un ítem DoD por su ID. """
    deleteDodItem(id: ID!): Boolean!
    """ Reordena los ítems DoD según el array de IDs proporcionado. """
    reorderDodItems(projectId: ID!, orderedIds: [ID!]!): [DodItem!]!
  }
`;
