/**
 * Optimiza URLs de Cloudinary inyectando transformaciones automáticas al vuelo:
 * - f_auto: Formato óptimo según navegador (AVIF o WebP).
 * - q_auto: Compresión inteligente sin pérdida perceptible.
 * - w_XXX,c_limit: Redimensiona al ancho exacto sin distorsionar.
 * 
 * Si no es de Cloudinary o es local, se devuelve tal cual.
 */
export function optimizeProductImage(imageUrl?: string | null, width = 320): string {
  if (!imageUrl) return '';

  const trimmed = imageUrl.trim();
  if (!trimmed) return '';

  if (trimmed.includes('cloudinary.com') && trimmed.includes('/upload/')) {
    // Si ya contiene f_auto o q_auto, no duplicar transformaciones
    if (trimmed.includes('/f_auto') || trimmed.includes('f_auto,')) {
      return trimmed;
    }

    const transformSegment = `f_auto,q_auto,w_${width},c_limit`;
    return trimmed.replace('/upload/', `/upload/${transformSegment}/`);
  }

  return trimmed;
}

export function getProductImage(
  categoryId: number,
  imageUrl?: string | null,
  width = 320
): string {
  if (imageUrl && imageUrl.trim()) {
    return optimizeProductImage(imageUrl, width);
  }

  switch (categoryId) {
    case 1:
      return '/images/beers.jpg';
    case 2:
      return '/images/liquors.jpg';
    case 3:
      return '/images/slush.jpg';
    case 4:
      return '/images/sodas.jpg';
    case 5:
      return '/images/snacks.jpg';
    default:
      return '/images/beers.jpg';
  }
}
