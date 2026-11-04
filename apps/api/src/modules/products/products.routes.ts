import { Router } from 'express';
import {
  getPhotographerProductsHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from './products.controller.js';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';

export const photographerProductsRouter: Router = Router();

photographerProductsRouter.get(
  '/:photographerId/products',
  getPhotographerProductsHandler,
);

photographerProductsRouter.post(
  '/me/products',
  authenticate,
  requireAccountType('PHOTOGRAPHER'),
  createProductHandler,
);

photographerProductsRouter.patch(
  '/me/products/:productId',
  authenticate,
  requireAccountType('PHOTOGRAPHER'),
  updateProductHandler,
);

photographerProductsRouter.delete(
  '/me/products/:productId',
  authenticate,
  requireAccountType('PHOTOGRAPHER'),
  deleteProductHandler,
);
