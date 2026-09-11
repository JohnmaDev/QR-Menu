/**
 * Formateador monetario para pesos colombianos (COP).
 * Ejemplo: 5000 -> "$5.000"
 */
export function formatCOP(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$0';
  }

  // Formato estándar colombiano sin decimales: $13.500
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);

  // Normalizar para obtener formato consistente sin espacios $13.500
  return formatted.replace(/\s+/g, '');
}

