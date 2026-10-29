import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { getMeHandler } from './users.controller.js';

export const usersRouter: Router = Router();

usersRouter.get('/me', authenticate, getMeHandler);
