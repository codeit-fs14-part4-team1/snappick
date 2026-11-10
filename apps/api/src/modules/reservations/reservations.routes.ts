import { Router } from 'express';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';
import {
  createReservationHandler,
  getReservationDetailHandler,
  createCancelReservationHandler,
} from './reservations.controller.js';

export const myReservationsRouter: Router = Router();

myReservationsRouter.post(
  '/reservations',
  authenticate,
  requireAccountType('USER'),
  createReservationHandler,
);

myReservationsRouter.get(
  '/reservations/:reservationId',
  authenticate,
  getReservationDetailHandler,
);

myReservationsRouter.post(
  '/reservations/:reservationId/cancel',
  authenticate,
  createCancelReservationHandler,
);
