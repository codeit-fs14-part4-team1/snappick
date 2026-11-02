import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

/**
 * 탐색에 노출할 수 있는 작가 (PF-10, PF-11)
 * 프로필 이미지·활동명·상세 소개·활동 지역·촬영 카테고리가 있는 작가
 * 활동명(nickname)은 필수 컬럼이라 따로 확인하지 않는다
 *
 * TODO: 프로필 완료 기준(readiness)은 프로필 파트와 같은 함수를 쓰도록 맞추기
 */
const LISTED_WHERE: Prisma.photographersWhereInput = {
  profile_image_url: { not: null },
  introduction: { not: null },
  NOT: [{ regions: { isEmpty: true } }, { categories: { isEmpty: true } }],
};

export async function getListedPhotographerIds(): Promise<string[]> {
  const listed = await prisma.photographers.findMany({
    where: LISTED_WHERE,
    select: { id: true },
  });
  return listed.map(({ id }) => id);
}

export async function isListedPhotographer(id: string): Promise<boolean> {
  const listed = await prisma.photographers.findFirst({
    where: { id, ...LISTED_WHERE },
    select: { id: true },
  });
  return listed !== null;
}
