import { Router } from 'express';
import { signupHandler } from './auth.controller.js';

export const authRouter: Router = Router();

authRouter.post('/signup', signupHandler);
