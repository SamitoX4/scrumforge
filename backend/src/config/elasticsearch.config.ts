/**
 * elasticsearch.config.ts — Fábrica del cliente Elasticsearch con carga diferida.
 *
 * Elasticsearch es un servicio OPCIONAL en ScrumForge. Cuando está disponible,
 * los resolvers de búsqueda lo usan para búsqueda full-text sobre historias,
 * tareas y proyectos. Cuando no está configurado, los resolvers degradan
 * automáticamente a consultas LIKE de Prisma (más lentas pero funcionales).
 *
 * Diseño lazy:
 *  - El cliente se crea la primera vez que se llama a `getElasticsearchClient()`.
 *  - Si ELASTICSEARCH_URL no está definida o el paquete no está instalado,
 *    devuelve `null` y los resolvers usan el fallback de Prisma.
 *
 * Instalación cuando se necesite:
 *   npm install @elastic/elasticsearch
 */

import { logger } from '../utils/logger';

// Se usa `any` para que el módulo compile sin necesitar el paquete instalado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ESClient = any;

/** Cliente Elasticsearch cacheado tras la primera inicialización exitosa. */
let _client: ESClient | null = null;

/**
 * Devuelve un cliente Elasticsearch inicializado de forma diferida, o `null`
 * si no está configurado o el paquete no está instalado.
 *
 * Los resolvers de búsqueda deben llamar a esta función y ejecutar el fallback
 * a consultas Prisma cuando el resultado sea `null`, garantizando que la
 * funcionalidad de búsqueda básica siempre esté disponible.
 *
 * @returns Cliente Elasticsearch listo para usar, o `null` en modo degradado.
 */
export function getElasticsearchClient(): ESClient | null {
  // Reutilizar el cliente cacheado si ya fue inicializado
  if (_client) return _client;

  const url = process.env.ELASTICSEARCH_URL;
  if (!url) {
    logger.warn('ELASTICSEARCH_URL no definida — Elasticsearch desactivado (búsqueda vía Prisma)');
    return null;
  }

  try {
    // Carga inline con require para que el arranque no falle si el paquete
    // `@elastic/elasticsearch` no está instalado en el entorno.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client } = require('@elastic/elasticsearch');
    _client = new Client({ node: url });
    logger.info(`Elasticsearch configurado: ${url}`);
    return _client;
  } catch {
    logger.error('No se pudo inicializar Elasticsearch — continuando sin búsqueda full-text');
    return null;
  }
}

/**
 * Cierra la conexión con Elasticsearch de forma ordenada.
 * Se llama durante el graceful shutdown del servidor para liberar recursos.
 * Si no hay conexión activa, esta función no hace nada.
 */
export async function closeElasticsearch(): Promise<void> {
  if (_client) {
    // close() finaliza las peticiones HTTP en vuelo y cierra el pool de conexiones
    await _client.close?.();
    _client = null;
    logger.info('Elasticsearch desconectado');
  }
}
