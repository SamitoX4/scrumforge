/**
 * Formatea una fecha ISO a tiempo relativo en español.
 * Ej: "ahora mismo", "hace 5 min", "hace 2h", "hace 3d"
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'ahora mismo';
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `hace ${diffHrs}h`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `hace ${diffDays}d`;

  const diffMonths = Math.floor(diffDays / 30);
  return `hace ${diffMonths} mes${diffMonths > 1 ? 'es' : ''}`;
}

/**
 * Formatea una fecha ISO a formato corto legible en español.
 * Ej: "15 mar 2026"
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Retorna el número de días restantes hasta una fecha.
 * Negativo significa que ya pasó. Null si no hay fecha.
 */
export function getDaysRemaining(endDateStr: string | null | undefined): number | null {
  if (!endDateStr) return null;
  const end = new Date(endDateStr);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - now.getTime()) / 86_400_000);
}
