/**
 * @file LoginPage.tsx
 * @description Página de inicio de sesión. Actúa como envoltura delgada que combina
 * el layout de autenticación con el formulario de login.
 *
 * La separación entre la página y el formulario sigue el patrón de composición:
 * - `AuthLayout` provee la estructura visual común a todas las páginas de autenticación
 *   (logo, fondo, centrado, etc.) sin conocer qué formulario contiene.
 * - `LoginForm` encapsula toda la lógica del login (validaciones, mutaciones GraphQL,
 *   manejo de errores y OAuth).
 *
 * Esta página no tiene lógica propia; delegar en componentes especializados facilita
 * el testing de `LoginForm` de forma aislada y el reuso de `AuthLayout`.
 */

// src/pages/LoginPage.tsx
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { LoginForm } from '@/features/auth/components/LoginForm';

/**
 * Página de inicio de sesión de ScrumForge.
 *
 * Compone `AuthLayout` + `LoginForm` sin añadir lógica adicional.
 * Toda la lógica de autenticación vive en `LoginForm`.
 *
 * @returns JSX con el layout de autenticación conteniendo el formulario de login.
 */
export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
