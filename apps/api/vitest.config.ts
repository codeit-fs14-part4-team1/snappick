import { defineConfig } from 'vitest/config';

// API 정책 테스트 (QA 체크 ID를 테스트 이름으로 쓴다)
// 매 실행마다 로컬 테스트 DB(snappick_test)를 새로 만들고 시드를 넣는다. 개발 DB(snappick)는 건드리지 않는다
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],
    setupFiles: ['tests/setup/env.ts'],
    // 테스트들이 같은 DB를 쓰고 데이터를 바꾸므로 파일을 하나씩 실행한다
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    // 통과한 테스트의 출력도 보여 준다 ("기록한다" 줄의 값을 보기 위해)
    silent: false,
  },
});
