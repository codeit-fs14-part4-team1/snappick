import { Router } from 'express';
import {
  createChatHandler,
  getChatsHandler,
  getMessagesHandler,
  sendMessageHandler,
  markChatAsReadHandler,
} from './chats.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';

export const chatsRouter: Router = Router();

chatsRouter.post('/', authenticate, createChatHandler);
chatsRouter.get('/', authenticate, getChatsHandler);
chatsRouter.post('/:chatRoomId/messages', authenticate, sendMessageHandler);
chatsRouter.get('/:chatRoomId/messages', authenticate, getMessagesHandler);
chatsRouter.patch('/:chatRoomId/read', authenticate, markChatAsReadHandler);
