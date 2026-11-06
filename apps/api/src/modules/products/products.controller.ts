import type { Request, Response } from 'express';
import {
  productParamsSchema,
  createProductSchema,
  productIdParamsSchema,
  updateProductSchema,
} from './products.schema.js';
import {
  getPhotographerProducts,
  createPhotographerProducts,
  updateMyProduct,
  deleteMyProduct,
} from './products.service.js';
import { getAuth } from '../../middlewares/authenticate.js';

export async function getPhotographerProductsHandler(
  req: Request,
  res: Response,
) {
  const { photographerId } = productParamsSchema.parse(req.params);
  res.json(await getPhotographerProducts(photographerId));
}

export async function createProductHandler(req: Request, res: Response) {
  const input = createProductSchema.parse(req.body);
  res.status(201).json(await createPhotographerProducts(getAuth(req), input));
}

export async function updateProductHandler(req: Request, res: Response) {
  const { productId } = productIdParamsSchema.parse(req.params);
  const input = updateProductSchema.parse(req.body);
  res.json(await updateMyProduct(getAuth(req), productId, input));
}

export async function deleteProductHandler(req: Request, res: Response) {
  const { productId } = productIdParamsSchema.parse(req.params);
  await deleteMyProduct(getAuth(req), productId);
  res.status(204).end();
}
