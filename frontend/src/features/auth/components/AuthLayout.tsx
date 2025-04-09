import { ReactNode } from 'react';
import styles from './AuthLayout.module.scss';

/**
 * Props del componente AuthLayout.
 */
interface AuthLayoutProps {
  /** Contenido de la pantalla de autenticación (formulario de login, registro, etc.) */
  children: ReactNode;
}

/**
 * AuthLayout
 *
 * Plantilla visual compartida por todas las pantallas de autenticación.
 * Divide la pantalla en dos áreas:
 * - Panel izquierdo: contiene la marca (logo + nombre) y el formulario hijo.
 * - Panel derecho: ilustración decorativa (aria-hidden para lectores de pantalla).
 *
 * El diseño separa la identidad visual de la lógica de cada formulario,
 * evitando duplicar la estructura en LoginForm, RegisterForm, etc.
 *
 * @param children - Formulario u otro contenido de autenticación a renderizar.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.layout}>
      {/* Panel principal con marca y formulario */}
      <div className={styles.panel}>
        {/* Identidad de la aplicación — ícono + nombre */}
        <div className={styles.brand}>
          <span className={styles['brand__icon']}>⚒</span>
          <span className={styles['brand__name']}>ScrumForge</span>
        </div>
        {/* Slot donde se inyecta el formulario de cada ruta */}
        {children}
      </div>
      {/* Ilustración decorativa — oculta a tecnologías de asistencia */}
      <div className={styles.illustration} aria-hidden="true" />
    </div>
  );
}
