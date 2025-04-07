/** Sucesión de Fibonacci estándar para story points */
export const FIBONACCI_SEQUENCE = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const;

export type FibonacciPoint = (typeof FIBONACCI_SEQUENCE)[number];

/**
 * Retorna el valor de Fibonacci más cercano a un número dado.
 * Útil para normalizar estimaciones importadas.
 */
export function getClosestFibonacci(value: number): FibonacciPoint {
  return FIBONACCI_SEQUENCE.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
  );
}

/**
 * Formatea story points para mostrar en la UI.
 * Sin puntos → "—"; con puntos → "5 pts"
 */
export function formatPoints(points: number | null | undefined): string {
  if (points == null) return '—';
  return `${points} pts`;
}

/** Suma los puntos de un array de items */
export function sumPoints(items: Array<{ points?: number | null }>): number {
  return items.reduce((sum, item) => sum + (item.points ?? 0), 0);
}
