import { Prisma } from '../generated/prisma/client.js';
import { HttpError } from './http-error.js';

// lower(nickname) unique 인덱스 이름 (migration SQL에서 만든다)
const NICKNAME_UNIQUE_INDEX = 'auth_accounts_nickname_lower_key';

/**
 * 닉네임 중복으로 저장에 실패했는지 확인한다
 * 이메일 등 다른 값의 중복(P2002)과 구분하기 위해 위반한 인덱스 이름을 본다
 */
export function isNicknameConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const meta = error.meta as
    | {
        driverAdapterError?: {
          cause?: { constraint?: { index?: string } };
        };
      }
    | undefined;

  return (
    meta?.driverAdapterError?.cause?.constraint?.index === NICKNAME_UNIQUE_INDEX
  );
}

export const nicknameAlreadyExists = () =>
  new HttpError(409, 'NICKNAME_ALREADY_EXISTS', '이미 사용 중인 닉네임이에요.');
