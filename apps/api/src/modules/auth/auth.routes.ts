import { Router } from 'express';
import {
  loginHandler,
  refreshHandler,
  signupHandler,
} from './auth.controller.js';

export const authRouter: Router = Router();

authRouter.post('/signup', signupHandler);
authRouter.post('/login', loginHandler);
authRouter.post('/refresh', refreshHandler);
