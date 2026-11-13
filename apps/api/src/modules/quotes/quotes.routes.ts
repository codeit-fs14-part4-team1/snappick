import { Router } from 'express';

import { authenticate } from '../../middlewares/authenticate.js';
import { createQuoteHandler, getQuoteHandler } from './quotes.controller.js';

export const quotesRouter: Router = Router();

quotesRouter.post('/', authenticate, createQuoteHandler);
quotesRouter.get('/:quoteId', authenticate, getQuoteHandler);
