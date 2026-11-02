import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';

export async function getPhotographerProducts(photographerId: string) {
  const photographer = await prisma.photographers.findUnique({
    where: { id: photographerId },
    select: {
      id: true,
    },
  });

  if (!photographer) {
    throw new HttpError(
      404,
      'PHOTOGRAPHER_NOT_FOUND',
      '작가를 찾을 수 없어요.',
    );
  }

  const rows = await prisma.products.findMany({
    where: { photographer_id: photographerId },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      price: true,
      duration_minutes: true,
      photo_count: true,
      includes_original: true,
      common_notice: true,
    },
  });

  return {
    items: rows.map((product) => ({
      productId: product.id,
      name: product.name,
      price: product.price,
      durationMinutes: product.duration_minutes,
      photoCount: product.photo_count,
      includesOriginal: product.includes_original,
      commonNotice: product.common_notice,
    })),
  };
}
