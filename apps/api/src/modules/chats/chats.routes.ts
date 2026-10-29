import { Router } from 'express';
import { createChatHandler } from './chats.controller.js';

export const chatsRouter: Router = Router();

chatsRouter.post('/', createChatHandler);
