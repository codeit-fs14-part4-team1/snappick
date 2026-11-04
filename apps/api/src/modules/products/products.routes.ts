import { Router } from 'express';
import {
  getPhotographerProductsHandler,
  createProductHandler,
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
