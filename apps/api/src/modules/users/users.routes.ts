import { Router } from 'express';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';
import { getMeHandler, updateUserNicknameHandler } from './users.controller.js';

export const usersRouter: Router = Router();

usersRouter.get('/me', authenticate, getMeHandler);
usersRouter.patch(
  '/me',
  authenticate,
  requireAccountType('USER'),
  updateUserNicknameHandler,
);
