/**
 * json.scalar.ts — Escalar GraphQL `JSON`.
 *
 * GraphQL no incluye un tipo JSON nativo. Este escalar acepta cualquier valor
 * JSON válido (objeto, array, string, número, booleano o null) y lo transmite
 * sin transformación entre el cliente y el servidor.
 *
 * Se usa en campos donde la estructura de los datos es dinámica o desconocida
 * en tiempo de diseño del schema, como:
 *  - `payload` de notificaciones y eventos (estructura varía por tipo de evento).
 *  - `limits` de los planes de suscripción (cada plan puede definir límites
 *    con claves arbitrarias).
 *  - `metadata` de integraciones externas.
 *
 * Uso en typedefs: `payload: JSON`
 */

import { GraphQLScalarType, Kind, type ValueNode, type ObjectValueNode, type ListValueNode } from 'graphql';

/** Typedef SDL para registrar el escalar en el schema. */
export const jsonScalarTypeDefs = `#graphql
  scalar JSON
`;

/**
 * Convierte recursivamente un nodo AST del documento GraphQL en un valor
 * JavaScript nativo. Se usa en `parseLiteral` para procesar valores JSON
 * escritos directamente en el documento de la query (no en variables).
 *
 * Maneja todos los tipos de nodos que pueden aparecer en un valor JSON:
 * string, booleano, entero, flotante, objeto, lista y null.
 *
 * @param ast - Nodo del AST de GraphQL a convertir.
 * @returns Valor JavaScript equivalente al nodo AST.
 */
function parseLiteralToJson(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      // Los strings y booleanos se devuelven directamente sin conversión
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      // Los nodos numéricos del AST siempre tienen `value` como string;
      // parseFloat convierte tanto enteros como decimales correctamente.
      return parseFloat(ast.value);
    case Kind.OBJECT: {
      // Recorrer todos los campos del objeto y convertir cada valor recursivamente
      const obj: Record<string, unknown> = {};
      (ast as ObjectValueNode).fields.forEach((field) => {
        obj[field.name.value] = parseLiteralToJson(field.value);
      });
      return obj;
    }
    case Kind.LIST:
      // Convertir cada elemento de la lista recursivamente
      return (ast as ListValueNode).values.map(parseLiteralToJson);
    case Kind.NULL:
      return null;
    default:
      // Variables ($var) u otros nodos no literales — no se pueden resolver
      return undefined;
  }
}

/**
 * Implementación del escalar JSON.
 *
 * `serialize` y `parseValue` son identidades (pasan el valor tal cual) porque
 * JSON ya es el formato nativo de intercambio entre Apollo y los resolvers.
 * Solo `parseLiteral` necesita lógica real para convertir el AST a objetos JS.
 */
export const jsonScalarResolvers = {
  JSON: new GraphQLScalarType({
    name: 'JSON',
    description: 'Arbitrary JSON value — serialized as a JavaScript object.',

    /**
     * Serialización: el valor ya es un objeto/array JS, se pasa directamente
     * al proceso de serialización JSON de Apollo.
     */
    serialize(value: unknown): unknown {
      return value;
    },

    /**
     * Parseo de variable: el valor ya fue deserializado por Express/JSON.parse
     * antes de llegar aquí, por lo que no es necesaria ninguna conversión.
     */
    parseValue(value: unknown): unknown {
      return value;
    },

    /**
     * Parseo de literal SDL: convierte el AST GraphQL en un valor JS.
     * Solo se usa cuando el valor JSON se escribe inline en la query,
     * no en una variable (caso poco frecuente en la práctica).
     */
    parseLiteral(ast: ValueNode): unknown {
      return parseLiteralToJson(ast);
    },
  }),
};
