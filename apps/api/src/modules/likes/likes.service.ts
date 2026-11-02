import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';

const photoNotFound = () =>
  new HttpError(404, 'PHOTO_NOT_FOUND', '사진을 찾을 수 없어요.');
const photographerNotFound = () =>
  new HttpError(404, 'PHOTOGRAPHER_NOT_FOUND', '작가를 찾을 수 없어요.');

async function assertPhotoExists(photoId: string): Promise<void> {
  const photo = await prisma.photos.findUnique({
    where: { id: photoId },
    select: { id: true },
  });
  if (!photo) throw photoNotFound();
}

async function assertPhotographerExists(photographerId: string): Promise<void> {
  const photographer = await prisma.photographers.findUnique({
    where: { id: photographerId },
    select: { id: true },
  });
  if (!photographer) throw photographerNotFound();
}

const countLikes = (photoId: string) =>
  prisma.photo_likes.count({ where: { photo_id: photoId } });

// 좋아요·저장은 여러 번 눌러도 결과가 같다 (이미 있으면 그대로, 없으면 그대로)

export async function likePhoto(userId: string, photoId: string) {
  await assertPhotoExists(photoId);
  await prisma.photo_likes.createMany({
    data: [{ user_id: userId, photo_id: photoId }],
    skipDuplicates: true,
  });
  return { photoId, liked: true, likeCount: await countLikes(photoId) };
}

export async function unlikePhoto(userId: string, photoId: string) {
  await assertPhotoExists(photoId);
  await prisma.photo_likes.deleteMany({
    where: { user_id: userId, photo_id: photoId },
  });
  return { photoId, liked: false, likeCount: await countLikes(photoId) };
}

export async function savePhotographer(userId: string, photographerId: string) {
  await assertPhotographerExists(photographerId);
  await prisma.photographer_saves.createMany({
    data: [{ user_id: userId, photographer_id: photographerId }],
    skipDuplicates: true,
  });
  return { photographerId, saved: true };
}

export async function unsavePhotographer(
  userId: string,
  photographerId: string,
) {
  await assertPhotographerExists(photographerId);
  await prisma.photographer_saves.deleteMany({
    where: { user_id: userId, photographer_id: photographerId },
  });
  return { photographerId, saved: false };
}
