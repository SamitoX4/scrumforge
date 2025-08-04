/**
 * @file useDebounce.ts
 * @description Hook genérico de debounce — retrasa la propagación de un valor
 * hasta que haya dejado de cambiar durante el tiempo especificado.
 *
 * Útil para evitar llamadas excesivas a APIs mientras el usuario escribe
 * (buscadores, filtros en tiempo real, autoguardado de formularios, etc.).
 *
 * Mecanismo: cada vez que `value` o `delay` cambian, se programa un temporizador.
 * Si antes de que expire llega otro cambio, el temporizador se cancela y se
 * reprograma. Solo cuando el valor se estabiliza el `delay` completo sin cambios,
 * el valor debounced se actualiza y el componente re-renderiza.
 */
import { useState, useEffect } from 'react';

/**
 * Retrasa la actualización de un valor hasta que haya dejado de cambiar
 * durante `delay` milisegundos.
 *
 * @template T - Tipo del valor a debouncear. El hook es completamente genérico
 *               y funciona con strings, números, objetos, etc.
 * @param value - Valor reactivo que puede cambiar frecuentemente.
 * @param delay - Tiempo en ms a esperar tras el último cambio (por defecto 300ms).
 * @returns El valor estabilizado tras el período de debounce.
 *
 * @example
 * // En un buscador: solo consultar la API cuando el usuario deja de escribir
 * const debouncedQuery = useDebounce(searchInput, 400);
 * useEffect(() => {
 *   if (debouncedQuery) fetchResults(debouncedQuery);
 * }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay = 300): T {
  // Estado interno que solo se actualiza cuando el valor se estabiliza
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // Programar la actualización del valor debounced tras `delay` ms
    const timer = setTimeout(() => setDebounced(value), delay);
    // Cancelar el temporizador si el valor cambia antes de que expire,
    // o cuando el componente se desmonta (evita actualizar estado en un componente muerto)
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
