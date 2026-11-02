import { Router } from 'express';
import { getPhotographerProductsHandler } from './products.controller.js';

export const photographerProductsRouter: Router = Router();

photographerProductsRouter.get(
  '/:photographerId/products',
  getPhotographerProductsHandler,
);
