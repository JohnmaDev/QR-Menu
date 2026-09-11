export function getProductImage(categoryId: number, imageUrl?: string | null): string {
  if (imageUrl) {
    return imageUrl;
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
