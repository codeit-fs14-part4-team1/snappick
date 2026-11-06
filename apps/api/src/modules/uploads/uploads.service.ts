import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { removeFiles, storage } from '../../lib/storage/index.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { HttpError } from '../../utils/http-error.js';
import {
  oneAtATime,
  toStoredWebp,
  type StoredImage,
} from './image-processor.js';
import { parsePhotoInfo, type PhotoInfo } from './photo-info.js';
import {
  MAX_FILE_SIZE,
  UPLOAD_EXTENSIONS,
  type RegisterPhotosBody,
  type UploadUrlsBody,
} from './uploads.schema.js';

const UPLOAD_URL_TTL_MS = 10 * 60 * 1000;

const uploadNotFound = () =>
  new HttpError(
    404,
    'UPLOAD_NOT_FOUND',
    '업로드한 파일을 찾을 수 없어요. 다시 올려 주세요.',
  );

const invalidFile = (message: string) =>
  new HttpError(400, 'INVALID_FILE', message);

/**
 * 업로드 URL 발급 (POST /me/photos/upload-urls)
 * 형식·용량이 맞지 않는 파일이 하나라도 있으면 URL을 발급하지 않는다 (PF-02, PF-03)
 */
export async function createUploadUrls(
  photographerId: string,
  body: UploadUrlsBody,
  apiOrigin: string,
) {
  if (body.policyAgreed !== true) {
    throw new HttpError(
      400,
      'POLICY_NOT_AGREED',
      '업로드 정책에 동의해야 사진을 올릴 수 있어요.',
    );
  }

  const files = body.files.map((file) => {
    const extension: string | undefined = UPLOAD_EXTENSIONS[file.contentType];
    if (!extension) {
      throw invalidFile(
        `${file.fileName}: JPG, PNG, WebP 파일만 올릴 수 있어요.`,
      );
    }
    if (file.fileSize > MAX_FILE_SIZE) {
      throw invalidFile(`${file.fileName}: 파일은 20MB 이하만 올릴 수 있어요.`);
    }
    return {
      ...file,
      key: `uploads/${photographerId}/${randomUUID()}.${extension}`,
    };
  });

  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS);
  const items = await Promise.all(
    files.map(async (file) => ({
      fileName: file.fileName,
      uploadKey: file.key,
      uploadUrl: await storage.createUploadUrl({
        key: file.key,
        contentType: file.contentType,
        size: file.fileSize,
        expiresAt,
        apiOrigin,
      }),
      expiresAt: expiresAt.toISOString(),
    })),
  );
  return { items };
}

const UPLOAD_KEY =
  /^uploads\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/;

// 임시 원본 키로 보관본 키를 정한다. 다시 시도해도 같은 키라 중복이 생기지 않는다
// 다른 작가가 받은 키나 형식이 다른 키는 없는 파일로 본다
function toPhotoKey(uploadKey: string, photographerId: string): string {
  const match = UPLOAD_KEY.exec(uploadKey);
  if (!match || match[1] !== photographerId) {
    throw uploadNotFound();
  }
  return `photos/${photographerId}/${match[2]}.webp`;
}

type NewPhoto = {
  uploadKey: string;
  photoKey: string;
  info: PhotoInfo;
};

// 임시 원본을 WebP 보관본으로 바꿔 저장한다 (PF-05)
async function storePhoto(item: NewPhoto): Promise<StoredImage> {
  const object = await storage.head(item.uploadKey);
  if (!object) {
    throw uploadNotFound();
  }
  if (object.size > MAX_FILE_SIZE) {
    throw invalidFile('파일은 20MB 이하만 올릴 수 있어요.');
  }

  const extension = item.uploadKey.slice(item.uploadKey.lastIndexOf('.') + 1);
  const image = await toStoredWebp(
    await storage.read(item.uploadKey),
    extension,
  );
  if (!image) {
    throw invalidFile('이미지 파일이 아니거나 형식이 올바르지 않아요.');
  }
  await storage.write(item.photoKey, image.data, 'image/webp');
  return image;
}

// 사진 한 장만 실패로 처리하는 파일 오류
const FILE_ERRORS = new Set(['UPLOAD_NOT_FOUND', 'INVALID_FILE']);

type FailedPhoto = { uploadKey: string; code: string; message: string };

type RegisteredPhoto = {
  id: string;
  storage_location: string;
  width: number;
  height: number;
};

/**
 * 사진 등록 (POST /me/photos)
 * 저장소에 올라온 파일을 WebP로 바꿔 저장하고 photos 행을 만든다
 * 이미 등록한 업로드 키는 기존 사진을 돌려준다(멱등)
 * 파일 문제(없는 파일, 이미지가 아님)는 그 사진만 failed로 돌려주고 나머지는 등록한다 (PF-04)
 * 입력값 오류나 저장 오류는 아무것도 등록하지 않는다
 */
export async function registerPhotos(
  photographerId: string,
  body: RegisterPhotosBody,
) {
  const items = body.items.map((item) => ({
    uploadKey: item.uploadKey,
    photoKey: toPhotoKey(item.uploadKey, photographerId),
    info: parsePhotoInfo(item),
  }));

  const representativeKey = body.representativeUploadKey ?? null;
  if (
    representativeKey !== null &&
    !items.some((item) => item.uploadKey === representativeKey)
  ) {
    throw new HttpError(
      400,
      'INVALID_REPRESENTATIVE',
      '대표 사진은 등록하는 사진 중에서 골라 주세요.',
    );
  }

  // 변환은 메모리를 많이 쓰고, 같은 키를 동시에 보내면 사진이 중복될 수 있어 등록 전체를 한 건씩 처리한다
  // staging은 인스턴스가 1대라 이것으로 충분하다. 여러 대로 늘리면 DB 잠금이 필요하다
  return oneAtATime(() =>
    saveNewPhotos(photographerId, items, representativeKey),
  );
}

async function saveNewPhotos(
  photographerId: string,
  items: NewPhoto[],
  representativeKey: string | null,
) {
  const photoSelect = {
    id: true,
    storage_location: true,
    width: true,
    height: true,
  } as const;
  const existing = await prisma.photos.findMany({
    where: {
      photographer_id: photographerId,
      storage_location: { in: items.map((item) => item.photoKey) },
    },
    select: photoSelect,
  });
  const registered = new Map<string, RegisteredPhoto>(
    existing.map((photo) => [photo.storage_location, photo]),
  );
  const newItems = items.filter((item) => !registered.has(item.photoKey));

  const stored: { item: NewPhoto; image: StoredImage }[] = [];
  const failed: FailedPhoto[] = [];
  try {
    for (const item of newItems) {
      try {
        stored.push({ item, image: await storePhoto(item) });
      } catch (error) {
        if (!(error instanceof HttpError) || !FILE_ERRORS.has(error.code)) {
          throw error;
        }
        failed.push({
          uploadKey: item.uploadKey,
          code: error.code,
          message: error.message,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const { item, image } of stored) {
        const photo = await tx.photos.create({
          data: {
            photographer_id: photographerId,
            storage_location: item.photoKey,
            width: image.width,
            height: image.height,
            categories: item.info.categories,
            styles: item.info.styles,
            description: item.info.description,
            photoKeyword: {
              create: item.info.keywords.map((keyword) => ({ keyword })),
            },
          },
          select: photoSelect,
        });
        registered.set(item.photoKey, photo);
      }

      // PF-12: 작가당 1장, 새로 지정하면 기존 대표를 바꾼다. 대표로 고른 사진이 실패하면 바꾸지 않는다
      const representative = items.find(
        (item) => item.uploadKey === representativeKey,
      );
      const photo = representative && registered.get(representative.photoKey);
      if (photo) {
        await tx.representative_photos.upsert({
          where: { photographer_id: photographerId },
          create: { photographer_id: photographerId, photo_id: photo.id },
          update: { photo_id: photo.id },
        });
      }
    });
  } catch (error) {
    await removeFiles(stored.map(({ item }) => item.photoKey));
    throw error;
  }

  // 원본을 못 지워도 등록은 성공이다. 남은 파일은 버킷 수명 주기 규칙이 지운다
  await removeFiles(stored.map(({ item }) => item.uploadKey));

  const [representative, photoCount] = await Promise.all([
    prisma.representative_photos.findUnique({
      where: { photographer_id: photographerId },
      select: { photo_id: true },
    }),
    prisma.photos.count({ where: { photographer_id: photographerId } }),
  ]);

  return {
    items: items.flatMap((item) => {
      const photo = registered.get(item.photoKey);
      return photo
        ? [
            {
              uploadKey: item.uploadKey,
              photoId: photo.id,
              imageUrl: toImageUrl(photo.storage_location),
              width: photo.width,
              height: photo.height,
            },
          ]
        : [];
    }),
    failed,
    representativePhotoId: representative?.photo_id ?? null,
    photoCount,
  };
}
