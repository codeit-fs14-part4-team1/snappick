import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { AccessTokenPayload } from '../../utils/tokens.js';
import type {
  CreateProductInput,
  UpdateProductInput,
} from './products.schema.js';
import { MAX_PRODUCTS_PER_PHOTOGRAPHER } from './products.constants.js';

type ProductRow = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  photo_count: number;
  includes_original: boolean;
  common_notice: string | null;
};

// 목록과 등록 응답이 같은 모양을 쓰도록 한곳에서 변환한다
const toProductResponse = (product: ProductRow) => ({
  productId: product.id,
  name: product.name,
  price: product.price,
  durationMinutes: product.duration_minutes,
  photoCount: product.photo_count,
  includesOriginal: product.includes_original,
  commonNotice: product.common_notice,
});

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

  return { items: rows.map(toProductResponse) };
}

export async function createPhotographerProducts(
  auth: AccessTokenPayload,
  input: CreateProductInput,
) {
  const photographer = await prisma.photographers.findUnique({
    where: { auth_account_id: auth.accountId },
    select: { id: true },
  });
  if (!photographer) {
    throw new HttpError(404, 'PROFILE_NOT_FOUND', '프로필을 찾을 수 없어요.');
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM photographers WHERE id = ${photographer.id}::uuid FOR UPDATE`;

    const count = await tx.products.count({
      where: { photographer_id: photographer.id },
    });
    if (count >= MAX_PRODUCTS_PER_PHOTOGRAPHER) {
      throw new HttpError(
        409,
        'PRODUCT_LIMIT_EXCEEDED',
        `상품은 최대 ${MAX_PRODUCTS_PER_PHOTOGRAPHER}개까지 등록할 수 있어요.`,
      );
    }

    return tx.products.create({
      data: {
        photographer_id: photographer.id,
        name: input.name,
        price: input.price,
        duration_minutes: input.durationMinutes,
        photo_count: input.photoCount,
        includes_original: input.includesOriginal,
        common_notice: input.commonNotice ?? null,
      },
    });
  });

  return toProductResponse(created);
}

const PRODUCT_NOT_FOUND = () =>
  new HttpError(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없어요.');

export async function updateMyProduct(
  auth: AccessTokenPayload,
  productId: string,
  input: UpdateProductInput,
) {
  const mine = await prisma.products.findFirst({
    where: { id: productId, photographer: { auth_account_id: auth.accountId } },
    select: { id: true },
  });
  if (!mine) {
    throw PRODUCT_NOT_FOUND();
  }

  const updated = await prisma.products.update({
    where: { id: productId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.durationMinutes !== undefined && {
        duration_minutes: input.durationMinutes,
      }),
      ...(input.photoCount !== undefined && { photo_count: input.photoCount }),
      ...(input.includesOriginal !== undefined && {
        includes_original: input.includesOriginal,
      }),
      ...(input.commonNotice !== undefined && {
        common_notice: input.commonNotice,
      }),
    },
  });
  return toProductResponse(updated);
}

export async function deleteMyProduct(
  auth: AccessTokenPayload,
  productId: string,
) {
  const { count } = await prisma.products.deleteMany({
    where: { id: productId, photographer: { auth_account_id: auth.accountId } },
  });
  if (count === 0) {
    throw PRODUCT_NOT_FOUND();
  }
}
