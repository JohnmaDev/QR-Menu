/**
 * Sanitiza el parámetro de redirección para mitigar vulnerabilidades de Open Redirect (SEC-05).
 * Solo admite rutas relativas internas que comiencen con '/' y descarta enlaces externos,
 * barras dobles ('//'), y esquemas como javascript:, data:, https:, etc.
 */
export function sanitizeRedirectTarget(target: unknown, fallback = '/ops'): string {
  if (typeof target !== 'string' || !target.trim()) {
    return fallback;
  }

  const trimmed = target.trim();

  // Debe comenzar con exactamente un '/' y no con '//' ni esquemas como 'http:', 'javascript:', etc.
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.includes('://') &&
    !trimmed.startsWith('/\\')
  ) {
    return trimmed;
  }

  return fallback;
}
