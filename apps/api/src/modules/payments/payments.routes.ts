import { Router } from 'express';

import { authenticate } from '../../middlewares/authenticate.js';
import {
  confirmPaymentHandler,
  preparePaymentHandler,
} from './payments.controller.js';

export const paymentsRouter: Router = Router();

paymentsRouter.post('/', authenticate, preparePaymentHandler);
paymentsRouter.post('/confirm', authenticate, confirmPaymentHandler);
