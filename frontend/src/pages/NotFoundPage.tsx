/**
 * @file NotFoundPage.tsx
 * @description Página de error 404 para rutas no encontradas. Se renderiza cuando
 * el router no encuentra ninguna ruta que coincida con la URL solicitada.
 *
 * La página determina inteligentemente el destino del enlace "Volver al inicio"
 * basándose en el estado de autenticación del usuario:
 * - Usuario autenticado con workspace activo: redirige a su workspace (`/<slug>`).
 * - Usuario sin workspace o no autenticado: redirige al login.
 *
 * Esto evita el antipatrón de enviar a un usuario ya autenticado a `/login`,
 * lo que causaría una redirección adicional innecesaria (login → workspace).
 */

import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import styles from './NotFoundPage.module.scss';

/**
 * Página de error 404 — Ruta no encontrada.
 *
 * Muestra el código de error y un enlace de regreso adaptado al estado del usuario.
 * No usa animaciones ni interacciones complejas para mantener el tiempo de carga mínimo,
 * dado que el usuario ya está en una situación de error.
 *
 * @returns JSX con el código 404, mensaje y enlace de retorno contextualizado.
 */
export default function NotFoundPage() {
  const { currentWorkspaceSlug } = useAuthStore();

  // Si el usuario tiene un workspace activo en el store, redirigirlo allí directamente.
  // Si no (usuario anónimo o sesión sin workspace), enviarlo al login.
  const homeUrl = currentWorkspaceSlug ? `/${currentWorkspaceSlug}` : '/login';

  return (
    <div className={styles.page}>
      <h1 className={styles.code}>404</h1>
      <p className={styles.message}>Página no encontrada</p>
      <Link to={homeUrl} className={styles.link}>
        Volver al inicio →
      </Link>
    </div>
  );
}
