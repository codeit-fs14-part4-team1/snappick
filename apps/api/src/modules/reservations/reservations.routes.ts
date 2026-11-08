import { Router } from 'express';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';
import { createReservationHandler } from './reservations.controller.js';

export const myReservationsRouter: Router = Router();

myReservationsRouter.post(
  '/reservations',
  authenticate,
  requireAccountType('USER'),
  createReservationHandler,
);
