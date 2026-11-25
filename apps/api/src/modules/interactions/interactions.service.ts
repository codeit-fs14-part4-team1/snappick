import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

type Db = Prisma.TransactionClient;

type ActionType = { userId: string } & (
  | { type: 'LIKE' | 'UNLIKE'; photoId: string }
  | {
      type: 'SAVE' | 'UNSAVE' | 'QUOTE' | 'RESERVE';
      photographerId: string;
    }
  | { type: 'REVIEW'; photographerId: string; rating: number }
);

export function createUserActionLog(input: ActionType, db: Db = prisma) {
  return db.user_interactions.create({
    data: {
      user_id: input.userId,
      type: input.type,
      photo_id: 'photoId' in input ? input.photoId : null,
      photographer_id: 'photographerId' in input ? input.photographerId : null,
      rating: 'rating' in input ? input.rating : null,
    },
  });
}
