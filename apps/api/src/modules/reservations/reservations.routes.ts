import { Router } from 'express';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';
import {
  createReservationHandler,
  getReservationDetailHandler,
  createCancelReservationHandler,
  patchCancelReservationHandler,
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

myReservationsRouter.patch(
  '/reservations/:reservationId/cancel/:cancelRequestId',
  authenticate,
  requireAccountType('PHOTOGRAPHER'),
  patchCancelReservationHandler,
);
