import 'dotenv/config';

export const TEST_DB_NAME = 'snappick_test';

/**
 * 테스트 DB 접속 주소: .env의 DATABASE_URL에서 DB 이름만 snappick_test로 바꾼다
 * 로컬 DB가 아니면 실행하지 않는다 (테스트가 DB를 지우고 다시 만들기 때문)
 */
export function testDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      '.env에 DATABASE_URL이 없습니다. 테스트는 로컬 DB에서만 실행합니다.',
    );
  }
  const url = new URL(base);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error(
      `로컬 DB가 아닙니다 (${url.hostname}). 테스트를 중단합니다.`,
    );
  }
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}
