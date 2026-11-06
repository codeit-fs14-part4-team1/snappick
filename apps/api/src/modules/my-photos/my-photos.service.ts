import { prisma } from '../../lib/prisma.js';
import { removeFiles } from '../../lib/storage/index.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { HttpError } from '../../utils/http-error.js';
import {
  parseCategories,
  parseDescription,
  parseKeywords,
  parseStyles,
} from '../uploads/photo-info.js';
import type { PhotoBatchBody } from './my-photos.schema.js';

const photoNotFound = () =>
  new HttpError(404, 'PHOTO_NOT_FOUND', '사진을 찾을 수 없어요.');
const forbidden = () => new HttpError(403, 'FORBIDDEN', '권한이 없어요.');

/**
 * 사진 수정용 정보 (GET /me/photos/{photoId})
 */
export async function getMyPhoto(photographerId: string, photoId: string) {
  const photo = await prisma.photos.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      photographer_id: true,
      storage_location: true,
      created_at: true,
      categories: true,
      styles: true,
      description: true,
      photoKeyword: { select: { keyword: true }, orderBy: { id: 'asc' } },
      representativePhoto: { select: { photographer_id: true } },
    },
  });
  if (!photo) {
    throw photoNotFound();
  }
  if (photo.photographer_id !== photographerId) {
    throw forbidden();
  }

  return {
    photoId: photo.id,
    imageUrl: toImageUrl(photo.storage_location),
    createdAt: photo.created_at.toISOString(),
    categories: photo.categories,
    styles: photo.styles,
    keywords: photo.photoKeyword.map(({ keyword }) => keyword),
    description: photo.description,
    isRepresentative: photo.representativePhoto.length > 0,
  };
}

function parseUpdate(update: PhotoBatchBody['updates'][number]) {
  return {
    photoId: update.photoId,
    data: {
      ...(update.categories && {
        categories: parseCategories(update.categories),
      }),
      ...(update.styles && { styles: parseStyles(update.styles) }),
      ...(update.description !== undefined && {
        description: parseDescription(update.description),
      }),
    },
    keywords: update.keywords && parseKeywords(update.keywords),
  };
}

/**
 * 사진 일괄 수정 (PATCH /me/photos/batch)
 * 수정·삭제·대표 지정을 한 트랜잭션으로 처리한다. 하나라도 실패하면 전체 취소
 */
export async function updateMyPhotos(
  photographerId: string,
  body: PhotoBatchBody,
) {
  const updateIds = body.updates.map(({ photoId }) => photoId);
  const deleteIds = body.deletePhotoIds;
  const representativeId = body.representativePhotoId ?? null;

  if (
    new Set(updateIds).size !== updateIds.length ||
    new Set(deleteIds).size !== deleteIds.length
  ) {
    throw new HttpError(
      400,
      'DUPLICATE_VALUE',
      '같은 값을 두 번 선택할 수 없어요.',
    );
  }
  if (updateIds.some((id) => deleteIds.includes(id))) {
    throw new HttpError(
      400,
      'CONFLICTING_PHOTO_ACTION',
      '삭제할 사진은 수정할 수 없어요.',
    );
  }
  const updates = body.updates.map(parseUpdate);

  const invalidRepresentative = () =>
    new HttpError(
      400,
      'INVALID_REPRESENTATIVE',
      '대표 사진으로 지정할 수 없는 사진이에요.',
    );
  if (representativeId && deleteIds.includes(representativeId)) {
    throw invalidRepresentative();
  }

  const targetIds = [...updateIds, ...deleteIds];
  const photos = await prisma.photos.findMany({
    where: {
      id: {
        in: representativeId ? [...targetIds, representativeId] : targetIds,
      },
    },
    select: { id: true, photographer_id: true, storage_location: true },
  });
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));

  for (const id of targetIds) {
    const photo = photoById.get(id);
    if (!photo) {
      throw photoNotFound();
    }
    if (photo.photographer_id !== photographerId) {
      throw forbidden();
    }
  }
  if (
    representativeId &&
    photoById.get(representativeId)?.photographer_id !== photographerId
  ) {
    throw invalidRepresentative();
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.photos.deleteMany({
      where: { id: { in: deleteIds }, photographer_id: photographerId },
    });
    if (deleted.count !== deleteIds.length) {
      throw photoNotFound();
    }

    for (const { photoId, data, keywords } of updates) {
      // 키워드만 바꿔도 수정 시각이 바뀌도록 updated_at을 직접 넣는다
      const updated = await tx.photos.updateMany({
        where: { id: photoId, photographer_id: photographerId },
        data: { ...data, updated_at: new Date() },
      });
      if (updated.count === 0) {
        throw photoNotFound();
      }
      if (keywords) {
        await tx.photo_keywords.deleteMany({ where: { photo_id: photoId } });
        await tx.photo_keywords.createMany({
          data: keywords.map((keyword) => ({ photo_id: photoId, keyword })),
        });
      }
    }

    // PF-12: 작가당 1장, 새로 지정하면 기존 대표를 바꾼다
    if (representativeId) {
      await tx.representative_photos.upsert({
        where: { photographer_id: photographerId },
        create: { photographer_id: photographerId, photo_id: representativeId },
        update: { photo_id: representativeId },
      });
    }
  });

  // 저장소에 올린 보관본만 지운다. 목 이미지(/mock/...)는 다른 데이터도 쓰므로 남긴다
  await removeFiles(
    deleteIds.flatMap((id) => {
      const location = photoById.get(id)?.storage_location;
      return location?.startsWith('photos/') ? [location] : [];
    }),
  );

  const [representative, photoCount] = await Promise.all([
    prisma.representative_photos.findUnique({
      where: { photographer_id: photographerId },
      select: { photo_id: true },
    }),
    prisma.photos.count({ where: { photographer_id: photographerId } }),
  ]);

  return {
    updatedCount: updates.length,
    deletedCount: deleteIds.length,
    representativePhotoId: representative?.photo_id ?? null,
    photoCount,
  };
}
