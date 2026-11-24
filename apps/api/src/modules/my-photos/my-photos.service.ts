import { Prisma } from '../../generated/prisma/client.js';
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

type BatchAction = 'DELETE' | 'UPDATE' | 'REPRESENTATIVE';
type BatchFailure = {
  action: BatchAction;
  photoId: string;
  code: string;
  message: string;
};

// DB 오류를 응답용 사유로 바꾼다. DB 원문 메시지는 응답에 넣지 않고 로그에만 남긴다
const CONNECTION_ERROR_CODES = ['P1001', 'P1002', 'P1017', 'P2024'];
function toFailureReason(
  error: unknown,
): Pick<BatchFailure, 'code' | 'message'> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') {
      return {
        code: 'WRITE_CONFLICT',
        message: '다른 요청과 겹쳐서 처리하지 못했어요. 다시 시도해 주세요.',
      };
    }
    if (CONNECTION_ERROR_CODES.includes(error.code)) {
      return {
        code: 'DB_UNAVAILABLE',
        message: '잠시 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.',
      };
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      code: 'DB_UNAVAILABLE',
      message: '잠시 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.',
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: '처리 중 오류가 났어요. 다시 시도해 주세요.',
  };
}

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
 * 요청 검사(중복, 권한, 수정 대상 존재)에 걸리면 아무것도 처리하지 않는다
 * 검사를 통과하면 수정·삭제·대표 지정을 사진마다 따로 처리하고,
 * 이미 없는 사진은 skippedPhotoIds, 오류로 실패한 항목은 retry와 failures(사유)로 돌려준다
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
  // raw는 실패했을 때 retry에 원래 요청 그대로 담기 위해 남긴다
  const updates = body.updates.map((raw) => ({ raw, ...parseUpdate(raw) }));

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

  for (const id of updateIds) {
    const photo = photoById.get(id);
    if (!photo) {
      throw photoNotFound();
    }
    if (photo.photographer_id !== photographerId) {
      throw forbidden();
    }
  }
  // 삭제는 이미 없는 사진(다른 탭에서 지웠거나 재요청)을 건너뛰고 나머지만 지운다
  // 다른 작가의 사진이 섞이면 전체를 막는다
  const existingDeleteIds = deleteIds.filter((id) => photoById.has(id));
  if (
    existingDeleteIds.some(
      (id) => photoById.get(id)?.photographer_id !== photographerId,
    )
  ) {
    throw forbidden();
  }
  if (
    representativeId &&
    photoById.get(representativeId)?.photographer_id !== photographerId
  ) {
    throw invalidRepresentative();
  }

  // 사진마다 따로 처리한다. 한 장이 실패해도 나머지는 반영된다
  // skipped: 이미 없는 사진이라 처리할 것이 없음 (다시 보낼 필요 없음)
  // retry: 오류로 실패해 다시 보내야 함. 그대로 같은 API의 요청 본문으로 쓸 수 있다
  // failures: retry에 담긴 항목마다 실패 사유
  const skippedPhotoIds: string[] = [];
  const retry: Required<PhotoBatchBody> = {
    updates: [],
    deletePhotoIds: [],
    representativePhotoId: null,
  };
  const failures: BatchFailure[] = [];
  const fail = (action: BatchAction, photoId: string, error: unknown) => {
    const reason = toFailureReason(error);
    failures.push({ action, photoId, ...reason });
    console.error(
      JSON.stringify({
        feature: 'photo-batch',
        action,
        photoId,
        code: reason.code,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  };

  skippedPhotoIds.push(...deleteIds.filter((id) => !photoById.has(id)));
  const deletedIds: string[] = [];
  for (const photoId of existingDeleteIds) {
    try {
      const deleted = await prisma.photos.deleteMany({
        where: { id: photoId, photographer_id: photographerId },
      });
      // 조회와 삭제 사이에 다른 요청이 먼저 지웠으면 건너뛴다
      (deleted.count > 0 ? deletedIds : skippedPhotoIds).push(photoId);
    } catch (error) {
      fail('DELETE', photoId, error);
      retry.deletePhotoIds.push(photoId);
    }
  }

  let updatedCount = 0;
  for (const { raw, photoId, data, keywords } of updates) {
    try {
      const found = await prisma.$transaction(async (tx) => {
        // 키워드만 바꿔도 수정 시각이 바뀌도록 updated_at을 직접 넣는다
        const updated = await tx.photos.updateMany({
          where: { id: photoId, photographer_id: photographerId },
          data: { ...data, updated_at: new Date() },
        });
        if (updated.count === 0) {
          return false;
        }
        if (keywords) {
          await tx.photo_keywords.deleteMany({ where: { photo_id: photoId } });
          await tx.photo_keywords.createMany({
            data: keywords.map((keyword) => ({ photo_id: photoId, keyword })),
          });
        }
        return true;
      });
      if (found) {
        updatedCount += 1;
      } else {
        skippedPhotoIds.push(photoId);
      }
    } catch (error) {
      fail('UPDATE', photoId, error);
      retry.updates.push(raw);
    }
  }

  // PF-12: 작가당 1장, 새로 지정하면 기존 대표를 바꾼다
  if (representativeId) {
    try {
      const found = await prisma.$transaction(async (tx) => {
        const photo = await tx.photos.findFirst({
          where: { id: representativeId, photographer_id: photographerId },
          select: { id: true },
        });
        if (!photo) {
          return false;
        }
        await tx.representative_photos.upsert({
          where: { photographer_id: photographerId },
          create: {
            photographer_id: photographerId,
            photo_id: representativeId,
          },
          update: { photo_id: representativeId },
        });
        return true;
      });
      if (!found) {
        skippedPhotoIds.push(representativeId);
      }
    } catch (error) {
      fail('REPRESENTATIVE', representativeId, error);
      retry.representativePhotoId = representativeId;
    }
  }

  // 저장소에 올린 보관본만 지운다. 목 이미지(/mock/...)는 다른 데이터도 쓰므로 남긴다
  await removeFiles(
    deletedIds.flatMap((id) => {
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

  const hasRetry =
    retry.updates.length > 0 ||
    retry.deletePhotoIds.length > 0 ||
    retry.representativePhotoId !== null;

  return {
    updatedCount,
    deletedCount: deletedIds.length,
    representativePhotoId: representative?.photo_id ?? null,
    photoCount,
    skippedPhotoIds,
    retry: hasRetry ? retry : null,
    failures,
  };
}
