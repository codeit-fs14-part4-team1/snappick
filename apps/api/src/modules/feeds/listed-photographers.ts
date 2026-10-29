import { prisma } from '../../lib/prisma.js';

const MIN_PHOTOS = 3;

/**
 * 탐색에 노출할 수 있는 작가 ID (PF-10, PF-11)
 * 프로필 이미지·소개·활동 지역·촬영 카테고리가 있고, 사진 3장 이상, 상품 1개 이상
 *
 * TODO: 프로필 완료 기준(readiness)은 프로필 파트와 같은 함수를 쓰도록 맞추기
 */
export async function getListedPhotographerIds(): Promise<string[]> {
  const withEnoughPhotos = await prisma.photos.groupBy({
    by: ['photographer_id'],
    _count: { _all: true },
  });
  const candidateIds = withEnoughPhotos
    .filter((row) => row._count._all >= MIN_PHOTOS)
    .map((row) => row.photographer_id);

  const listed = await prisma.photographers.findMany({
    where: {
      id: { in: candidateIds },
      profile_image_url: { not: null },
      introduction: { not: null },
      NOT: [{ regions: { isEmpty: true } }, { categories: { isEmpty: true } }],
      product: { some: {} },
    },
    select: { id: true },
  });
  return listed.map(({ id }) => id);
}

export async function isListedPhotographer(id: string): Promise<boolean> {
  return (await getListedPhotographerIds()).includes(id);
}
