/**
 * pnpm --filter api test
 * 테스트할 파트를 골라 vitest를 실행한다
 *
 * - 메뉴: tests/ 아래 *.test.ts가 있는 폴더가 하나의 파트다 (새 폴더를 만들면 자동으로 추가)
 * - 바로 실행: pnpm --filter api test feeds payments   (파트 이름, all이면 전체)
 * - vitest 옵션은 -- 뒤에: pnpm --filter api test payments -- -t "PAY-BE-13"
 * - 터미널이 아니면(CI 등) 메뉴 없이 전체를 실행한다
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

// 메뉴에 보일 이름. 없으면 폴더 이름을 그대로 쓴다
const LABELS: Record<string, string> = {
  feeds: 'FEED · 탐색 피드',
  payments: 'PAY · 결제 (토스 테스트 API 호출, 인터넷 필요)',
  reservations: 'RESV · 예약 목록 · 예약 생성',
  'reservation-detail': 'RESVDETAIL · 예약 상세 · 자동 촬영 완료',
  cancel: 'CANCEL · 취소 요청 · 확정 · 반려',
  reviews: 'REVIEW · 리뷰 · 작가 답글',
};

const testsDir = new URL('.', import.meta.url);

const parts = readdirSync(testsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    name: entry.name,
    files: readdirSync(new URL(`${entry.name}/`, testsDir)).filter((file) =>
      file.endsWith('.test.ts'),
    ),
  }))
  .filter(({ files }) => files.length > 0)
  .map(({ name, files }) => ({
    name,
    label: LABELS[name] ?? name,
    fileCount: files.length,
  }));

const args = process.argv.slice(2);
const separator = args.indexOf('--');
const picked = separator === -1 ? args : args.slice(0, separator);
const vitestArgs = separator === -1 ? [] : args.slice(separator + 1);

async function choose(): Promise<string[] | null> {
  if (picked.length > 0) {
    if (picked.includes('all')) return [];
    const unknown = picked.filter(
      (name) => !parts.some((part) => part.name === name),
    );
    if (unknown.length > 0) {
      console.error(`없는 파트: ${unknown.join(', ')}`);
      console.error(
        `가능한 파트: ${parts.map(({ name }) => name).join(', ')}, all`,
      );
      process.exit(1);
    }
    return picked;
  }

  if (!process.stdin.isTTY) return [];

  console.log('\n테스트할 파트를 고르세요 (여러 개는 쉼표로: 1,2)\n');
  console.log('  0) 전체');
  parts.forEach((part, i) =>
    console.log(
      `  ${i + 1}) ${part.label}  [${part.name}, 파일 ${part.fileCount}개]`,
    ),
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (
    await rl.question('\n번호 (Enter = 전체, q = 취소): ')
  ).trim();
  rl.close();

  if (answer === 'q') return null;
  if (answer === '' || answer === '0') return [];
  const numbers = answer.split(',').map((value) => Number(value.trim()));
  const invalid = numbers.filter(
    (n) => !Number.isInteger(n) || n < 1 || n > parts.length,
  );
  if (invalid.length > 0) {
    console.error(`잘못된 번호: ${answer}`);
    process.exit(1);
  }
  return [...new Set(numbers)].map((n) => parts[n - 1]!.name);
}

const selected = await choose();
if (selected === null) {
  console.log('취소했어요.');
  process.exit(0);
}

const targets = selected.map((name) => `tests/${name}`);
console.log(
  `\n실행: ${selected.length === 0 ? '전체' : selected.map((name) => LABELS[name] ?? name).join(', ')}\n`,
);

const result = spawnSync('npx', ['vitest', 'run', ...targets, ...vitestArgs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
