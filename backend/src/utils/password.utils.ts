/**
 * @file password.utils.ts
 * @description Utilidades para validación de la política de contraseñas de ScrumForge.
 *
 * Política adoptada (estándar de la industria — GitHub, Notion, Linear, Atlassian):
 *  - Mínimo 8 caracteres.
 *  - Al menos una letra mayúscula (A-Z).
 *  - Al menos una letra minúscula (a-z).
 *  - Al menos un dígito (0-9).
 *
 * Esta función centraliza la validación para que `auth.service.ts` y
 * `password-reset.service.ts` apliquen exactamente las mismas reglas,
 * evitando inconsistencias si la política cambia en el futuro.
 */

/**
 * Valida que una contraseña cumpla la política de seguridad de ScrumForge.
 *
 * @param password - Contraseña en texto plano a evaluar.
 * @returns `null` si la contraseña es válida, o un mensaje de error descriptivo si no lo es.
 *
 * @example
 * validatePassword('abc')        // → 'La contraseña debe tener al menos 8 caracteres'
 * validatePassword('abcdefgh')   // → 'La contraseña debe contener al menos una mayúscula'
 * validatePassword('Abcdefgh')   // → 'La contraseña debe contener al menos un número'
 * validatePassword('Abcdefg1')   // → null (válida)
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe contener al menos una letra mayúscula (A-Z)';
  }
  if (!/[a-z]/.test(password)) {
    return 'La contraseña debe contener al menos una letra minúscula (a-z)';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe contener al menos un número (0-9)';
  }
  return null;
}
