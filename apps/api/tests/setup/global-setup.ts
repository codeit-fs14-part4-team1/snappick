import { execSync } from 'node:child_process';
import pg from 'pg';
import { TEST_DB_NAME, testDatabaseUrl } from './test-db.js';

/**
 * 테스트 시작 전에 1번: 테스트 DB를 새로 만들고 migration과 시드를 넣는다
 * 매번 같은 데이터에서 시작해야 결과가 흔들리지 않는다
 */
export default async function setup() {
  const testUrl = testDatabaseUrl();

  // 개발 DB에 접속해 테스트 DB만 지우고 다시 만든다
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await admin.end();
  }

  const env = { ...process.env, DATABASE_URL: testUrl };
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  execSync('npx tsx src/scripts/seed.ts', { env, stdio: 'pipe' });
}
