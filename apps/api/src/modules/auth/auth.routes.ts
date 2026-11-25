import { Router } from 'express';
import {
  authenticate,
  optionalAuthenticate,
} from '../../middlewares/authenticate.js';
import {
  changePasswordHandler,
  checkNicknameHandler,
  getAccountHandler,
  linkProviderHandler,
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

// 가입 전(비회원)과 닉네임 수정(회원)에서 함께 쓴다
authRouter.get(
  '/nickname/availability',
  optionalAuthenticate,
  checkNicknameHandler,
);

// 일반 사용자·작가 공통
authRouter.get('/account', authenticate, getAccountHandler);
authRouter.patch('/password', authenticate, changePasswordHandler);
authRouter.post('/providers', authenticate, linkProviderHandler);
