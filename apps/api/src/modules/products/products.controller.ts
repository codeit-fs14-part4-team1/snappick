import type { Request, Response } from 'express';
import { productParamsSchema } from './products.schema.js';
import { getPhotographerProducts } from './products.service.js';

export async function getPhotographerProductsHandler(
  req: Request,
  res: Response,
) {
  const { photographerId } = productParamsSchema.parse(req.params);
  res.json(await getPhotographerProducts(photographerId));
}
