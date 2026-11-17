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
  getReservationHandler,
  getDeliverableHandler,
  createDeliverableHandler,
  patchDeliverableHandler,
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

myReservationsRouter.get('/reservations', authenticate, getReservationHandler);

myReservationsRouter.get(
  '/reservations/:reservationId/deliverable',
  authenticate,
  getDeliverableHandler,
);

myReservationsRouter.post(
  '/reservations/:reservationId/deliverable',
  authenticate,
  requireAccountType('PHOTOGRAPHER'),
  createDeliverableHandler,
);

myReservationsRouter.patch(
  '/reservations/:reservationId/deliverable',
  authenticate,
  requireAccountType('PHOTOGRAPHER'),
  patchDeliverableHandler,
);
