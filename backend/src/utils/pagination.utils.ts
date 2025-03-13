/**
 * @file pagination.utils.ts
 * @module utils
 * @description Utilidades para paginación basada en cursores (Relay-style).
 *
 * Implementa el patrón de paginación por cursor de la especificación Relay:
 * - `first`: número de elementos a retornar.
 * - `after`: cursor del último elemento visto (para cargar la siguiente página).
 *
 * Los cursores son opacos para el cliente: internamente corresponden
 * al campo `id` de los registros (UUID), lo que hace la paginación
 * estable ante inserciones concurrentes a diferencia de OFFSET/LIMIT.
 *
 * @see https://relay.dev/graphql/connections.htm
 */

/**
 * @interface PaginationArgs
 * @description Argumentos de entrada para una consulta paginada por cursor.
 */
export interface PaginationArgs {
  /** Número de elementos a retornar en esta página. */
  first?: number;
  /** Cursor del último elemento de la página anterior (exclusivo). */
  after?: string;
}

/**
 * @interface PageInfo
 * @description Metadatos de paginación retornados junto con los datos.
 */
export interface PageInfo {
  /** Indica si existe al menos una página siguiente. */
  hasNextPage: boolean;
  /** Cursor del último elemento retornado; null si la lista está vacía. */
  endCursor: string | null;
}

/**
 * @interface Connection
 * @description Estructura de una respuesta paginada tipo Relay.
 * Agrupa aristas (edge = nodo + cursor), metadatos de página y total.
 *
 * @template T - Tipo del nodo contenido en cada arista.
 */
export interface Connection<T> {
  /** Lista de aristas, cada una con el nodo y su cursor. */
  edges: Array<{ node: T; cursor: string }>;
  /** Metadatos sobre la paginación actual. */
  pageInfo: PageInfo;
  /** Total de registros disponibles (antes del límite). */
  totalCount: number;
}

/**
 * Construye una respuesta de paginación tipo Relay a partir de una lista
 * de elementos ya consultados de la base de datos.
 *
 * El cursor de cada elemento es su `id`, lo que evita la necesidad de
 * encodificar/decodificar cursores en Base64 para este caso de uso.
 *
 * `hasNextPage` se calcula comparando el `totalCount` real contra `first`:
 * si hay más registros en total de los que se retornan, existe una página siguiente.
 *
 * @param items - Lista de registros con campo `id` string (resultado de la query).
 * @param totalCount - Total de registros disponibles para esta consulta (sin el límite `take`).
 * @param first - Límite de elementos por página solicitado.
 * @returns Objeto Connection con edges, pageInfo y totalCount.
 */
export function buildConnection<T extends { id: string }>(
  items: T[],
  totalCount: number,
  first: number,
): Connection<T> {
  // Cada arista envuelve el nodo y expone su id como cursor opaco
  const edges = items.map((node) => ({ node, cursor: node.id }));

  // Si el total supera el límite solicitado, hay más páginas disponibles
  const hasNextPage = totalCount > first;

  // El cursor del final es el id del último elemento; null si la lista está vacía
  const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

  return { edges, pageInfo: { hasNextPage, endCursor }, totalCount };
}
