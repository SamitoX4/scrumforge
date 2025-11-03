/**
 * @file tls.config.ts
 * @description Carga las opciones TLS (certificado + clave privada) para el modo
 * `HTTPS_MODE=standalone`, en el que el backend levanta HTTPS directamente sin
 * depender de un reverse proxy.
 *
 * Casos de uso:
 *  - **Desarrollo/staging** — certificado autofirmado generado con openssl.
 *  - **Producción standalone** — certificado emitido por Let's Encrypt (Certbot)
 *    o cualquier CA, referenciado mediante las variables de entorno.
 *
 * Las rutas a los archivos PEM se leen de las variables de entorno:
 *  - `TLS_CERT_PATH` — ruta al archivo del certificado (fullchain.pem en Let's Encrypt).
 *  - `TLS_KEY_PATH`  — ruta al archivo de la clave privada (privkey.pem en Let's Encrypt).
 *
 * En modo `standalone`, `env.validation.ts` ya verifica que ambas variables estén
 * definidas antes de que este módulo sea importado.
 *
 * @example Generar un certificado autofirmado para desarrollo:
 * ```bash
 * openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem \
 *   -days 365 -nodes -subj '/CN=localhost'
 * TLS_CERT_PATH=./cert.pem TLS_KEY_PATH=./key.pem
 * ```
 *
 * @example Con Let's Encrypt (Certbot):
 * ```bash
 * TLS_CERT_PATH=/etc/letsencrypt/live/tu-dominio.com/fullchain.pem
 * TLS_KEY_PATH=/etc/letsencrypt/live/tu-dominio.com/privkey.pem
 * ```
 */

import fs from 'fs';

/**
 * Opciones TLS compatibles con `https.createServer` de Node.js.
 */
export interface TlsOptions {
  cert: Buffer;
  key: Buffer;
}

/**
 * Lee el certificado TLS y la clave privada desde las rutas definidas en las
 * variables de entorno `TLS_CERT_PATH` y `TLS_KEY_PATH`.
 *
 * Lanza un error descriptivo si alguna ruta no está definida o si los archivos
 * no existen en disco, de forma que el error sea inmediato y claro durante el
 * arranque del servidor.
 *
 * @returns Opciones TLS listas para pasarse a `https.createServer`.
 * @throws {Error} Si `TLS_CERT_PATH` o `TLS_KEY_PATH` no están definidas.
 * @throws {Error} Si los archivos no existen o no se pueden leer.
 */
export function loadTlsOptions(): TlsOptions {
  const certPath = process.env.TLS_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH;

  if (!certPath || !keyPath) {
    throw new Error(
      'HTTPS_MODE=standalone requiere TLS_CERT_PATH y TLS_KEY_PATH. ' +
      'Consulta la sección HTTPS en .env.example.',
    );
  }

  // Verificar existencia antes de leer para dar un mensaje de error más claro
  if (!fs.existsSync(certPath)) {
    throw new Error(`TLS_CERT_PATH apunta a un archivo que no existe: ${certPath}`);
  }
  if (!fs.existsSync(keyPath)) {
    throw new Error(`TLS_KEY_PATH apunta a un archivo que no existe: ${keyPath}`);
  }

  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
}
