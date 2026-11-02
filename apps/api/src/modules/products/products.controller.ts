import type { Request, Response } from 'express';
import { productParamsSchema, createProductSchema } from './products.schema.js';
import {
  getPhotographerProducts,
  createPhotographerProducts,
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
