import { Router } from 'express';
import {
  createChatHandler,
  getChatsHandler,
  sendMessageHandler,
} from './chats.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';

export const chatsRouter: Router = Router();

chatsRouter.post('/', authenticate, createChatHandler);
chatsRouter.get('/', authenticate, getChatsHandler);
chatsRouter.post('/:chatRoomId/messages', authenticate, sendMessageHandler);
