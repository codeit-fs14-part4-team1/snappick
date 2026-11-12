import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import {
  changePasswordHandler,
  getAccountHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  signupHandler,
} from './auth.controller.js';

export const authRouter: Router = Router();

authRouter.post('/signup', signupHandler);
authRouter.post('/login', loginHandler);
authRouter.post('/refresh', refreshHandler);
authRouter.post('/logout', logoutHandler);

// 일반 사용자·작가 공통
authRouter.get('/account', authenticate, getAccountHandler);
authRouter.patch('/password', authenticate, changePasswordHandler);
