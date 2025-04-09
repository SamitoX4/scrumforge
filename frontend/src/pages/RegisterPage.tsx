/**
 * @file RegisterPage.tsx
 * @description Página de registro de nuevos usuarios. Sigue el mismo patrón de composición
 * que `LoginPage`: es una envoltura delgada que combina el layout compartido de autenticación
 * con el formulario específico de registro.
 *
 * La razón de mantener páginas y formularios separados es doble:
 * 1. Permite registrar las páginas en el router sin acoplar la lógica de negocio al sistema
 *    de rutas (cada página es un componente lazy-loadable liviano).
 * 2. Permite testear `RegisterForm` de forma completamente aislada, inyectando mocks
 *    de Apollo y del router sin necesitar montar el layout completo.
 */

import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { RegisterForm } from '@/features/auth/components/RegisterForm';

/**
 * Página de registro de nuevos usuarios en ScrumForge.
 *
 * Delega toda la lógica (validaciones, mutación GraphQL, manejo de errores,
 * redirección post-registro) a `RegisterForm`.
 *
 * @returns JSX con el layout de autenticación conteniendo el formulario de registro.
 */
export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
