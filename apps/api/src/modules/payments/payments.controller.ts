import type { Request, Response } from 'express';

import { getAuth } from '../../middlewares/authenticate.js';
import {
  confirmPaymentSchema,
  preparePaymentSchema,
} from './payments.schema.js';
import { confirmPayment, preparePayment } from './payments.service.js';

export async function preparePaymentHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const input = preparePaymentSchema.parse(req.body);

  const { reused, ...result } = await preparePayment(auth.accountId, input);

  res.status(reused ? 200 : 201).json(result);
}

export async function confirmPaymentHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const input = confirmPaymentSchema.parse(req.body);

  const result = await confirmPayment(auth.accountId, input);

  res.status(200).json(result);
}
