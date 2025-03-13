/**
 * Strips HTML tags and trims whitespace from a string.
 * Prevents XSS in stored text that might be rendered in frontend.
 */
export function sanitizeString(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m] ?? m) // decode common HTML entities
    .trim();
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/**
 * Sanitizes a URL — only allows http/https protocols.
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed;
}

/**
 * Sanitizes webhook URL — must be a valid https URL.
 */
export function sanitizeWebhookUrl(url: string): string {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) throw new Error('URL de webhook inválida — debe comenzar con https://');
  return sanitized;
}

/**
 * Limits string length to prevent oversized inputs.
 */
export function limitLength(value: string, max: number): string {
  return value.slice(0, max);
}
