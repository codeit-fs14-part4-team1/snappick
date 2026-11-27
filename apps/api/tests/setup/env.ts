import { testDatabaseUrl } from './test-db.js';

// 앱 코드(lib/prisma.ts)를 불러오기 전에 테스트 DB를 바라보게 한다
process.env.DATABASE_URL = testDatabaseUrl();

// 토스는 .env의 테스트 키로 실제 테스트 API를 호출한다 (라이브 키면 앱 코드가 거부한다)
// 승인 성공처럼 결제창이 필요한 테스트만 tests/toss-mock.ts로 가짜 응답을 쓴다

// 업로드 테스트가 S3에 올리지 않도록 로컬 저장소(apps/web/public, git 제외)로 고정한다
process.env.STORAGE_DRIVER = 'local';
