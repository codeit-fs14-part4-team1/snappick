import { Router } from 'express';
import { createChatHandler } from './chats.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';

export const chatsRouter: Router = Router();

chatsRouter.post('/', authenticate, createChatHandler);
