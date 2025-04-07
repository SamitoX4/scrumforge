/** Valida que un string no esté vacío (ignora espacios) */
export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/** Valida formato de email */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Valida una URL (http o https) */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Valida que un string tenga al menos `min` caracteres */
export function hasMinLength(value: string, min: number): boolean {
  return value.trim().length >= min;
}

/** Valida que un número esté en un rango inclusivo */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
