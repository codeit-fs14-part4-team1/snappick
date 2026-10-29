import type { AccessTokenPayload } from '../utils/tokens.ts';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

export {};
