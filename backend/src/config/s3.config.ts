/**
 * s3.config.ts — Fábrica del cliente S3/MinIO con configuración diferida.
 *
 * Compatible con:
 *  - AWS S3: proporcionar S3_ENDPOINT apuntando a `https://s3.amazonaws.com`
 *    (o al endpoint regional) y las credenciales IAM correspondientes.
 *  - MinIO: proporcionar S3_ENDPOINT local (ej. `http://localhost:9000`).
 *    MinIO requiere `forcePathStyle: true` porque no soporta virtual-hosted style.
 *
 * Diseño lazy:
 *  - El cliente se crea la primera vez que se llama a `getS3Config()` y se
 *    cachea en `_config` para reutilizarlo en llamadas posteriores.
 *  - Si las variables de entorno no están definidas, devuelve `null` y los
 *    endpoints de subida de archivos devuelven un error descriptivo.
 *
 * Instalación cuando se necesite:
 *   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */

import { logger } from '../utils/logger';

// Se usa `any` para evitar depender del tipo exacto de S3Client del SDK,
// que puede no estar instalado en el entorno actual.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S3Client = any;

/**
 * Configuración completa del cliente S3, lista para usar en resolvers
 * y servicios de subida de archivos.
 */
export interface S3Config {
  /** Instancia del cliente S3 del AWS SDK. */
  client: S3Client;
  /** Nombre del bucket donde se almacenarán los archivos. */
  bucket: string;
}

/** Configuración cacheada tras la primera inicialización exitosa. */
let _config: S3Config | null = null;

/**
 * Devuelve la configuración del cliente S3 (cliente + bucket), o `null`
 * si las variables de entorno necesarias no están definidas.
 *
 * Compatible con AWS S3 y MinIO. La opción `forcePathStyle: true` es
 * necesaria para MinIO, que no soporta el estilo virtual-hosted de AWS
 * (donde el bucket forma parte del hostname: `bucket.s3.amazonaws.com`).
 *
 * @returns Configuración S3 lista para usar, o `null` si no está configurado.
 */
export function getS3Config(): S3Config | null {
  // Reutilizar la configuración cacheada si ya fue inicializada
  if (_config) return _config;

  const endpoint  = process.env.S3_ENDPOINT;
  const bucket    = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;

  // Endpoint y bucket son los mínimos necesarios para construir URLs válidas
  if (!endpoint || !bucket) {
    logger.warn('S3_ENDPOINT / S3_BUCKET no definidos — almacenamiento de archivos desactivado');
    return null;
  }

  try {
    // Carga dinámica para evitar error de arranque si el paquete no está instalado
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client } = require('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint,
      // La región es obligatoria en el SDK aunque MinIO la ignore;
      // 'us-east-1' es el valor por defecto convencional.
      region: 'us-east-1',
      credentials: {
        // Usar credenciales de entorno o el usuario admin por defecto de MinIO
        accessKeyId: accessKey ?? 'minioadmin',
        secretAccessKey: secretKey ?? 'minioadmin',
      },
      // forcePathStyle hace que las URLs sean `endpoint/bucket/key`
      // en lugar de `bucket.endpoint/key` — necesario para MinIO.
      forcePathStyle: true,
    });
    _config = { client, bucket };
    logger.info(`S3/MinIO configurado: ${endpoint} — bucket: ${bucket}`);
    return _config;
  } catch {
    logger.error('No se pudo inicializar el cliente S3 — almacenamiento desactivado');
    return null;
  }
}

/**
 * Destruye el cliente S3 y limpia la configuración cacheada.
 * Se llama durante el graceful shutdown o en tests para limpiar el estado.
 */
export function closeS3(): void {
  if (_config) {
    // destroy() cierra las conexiones HTTP persistentes del SDK
    _config.client?.destroy?.();
    _config = null;
    logger.info('S3 client destruido');
  }
}
