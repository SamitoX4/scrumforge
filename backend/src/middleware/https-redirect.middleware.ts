/**
 * @file https-redirect.middleware.ts
 * @description Middleware de redirección HTTP → HTTPS para el modo `proxy`.
 *
 * Cuando ScrumForge se despliega detrás de un reverse proxy (Caddy, Nginx, AWS ALB…)
 * el proxy termina TLS y reenvía las peticiones al backend por HTTP interno.
 * Para saber si la petición original llegó por HTTPS, el proxy añade la cabecera
 * `X-Forwarded-Proto: https`.
 *
 * Este middleware inspecciona esa cabecera y redirige (301 Moved Permanently) al
 * mismo recurso por HTTPS si la petición llegó originalmente por HTTP.
 *
 * **Requiere** que Express tenga habilitado `trust proxy` (configurado en `app.ts`
 * cuando `HTTPS_MODE=proxy`) para que `req.protocol` y las cabeceras `X-Forwarded-*`
 * sean fiables y no puedan ser suplantadas por un cliente malintencionado.
 *
 * Solo se activa cuando `HTTPS_MODE=proxy`. En los demás modos (`off`, `standalone`)
 * no se registra este middleware.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Redirige al cliente a HTTPS (301) si la petición llegó originalmente por HTTP.
 *
 * La detección se hace mediante `req.protocol`, que Express resuelve a partir de
 * la cabecera `X-Forwarded-Proto` cuando `trust proxy` está habilitado.
 *
 * Las peticiones al endpoint `/health` se excluyen de la redirección para que los
 * health checks del orquestador (Kubernetes, ECS, etc.) funcionen tanto por HTTP
 * como por HTTPS sin necesidad de reconfiguración.
 *
 * @param req  - Objeto de petición de Express.
 * @param res  - Objeto de respuesta de Express.
 * @param next - Función que pasa el control al siguiente middleware.
 */
export function httpsRedirectMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Los health checks deben funcionar siempre, incluso sin TLS
  if (req.path === '/health') {
    next();
    return;
  }

  // req.protocol vale 'https' cuando X-Forwarded-Proto es 'https'
  // (requiere trust proxy habilitado en app.ts)
  if (req.protocol !== 'https') {
    // 301 Permanent — el navegador y los crawlers actualizan sus bookmarks
    res.redirect(301, `https://${req.headers.host}${req.url}`);
    return;
  }

  next();
}
