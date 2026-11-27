/**
 * pnpm --filter api test
 * 테스트할 파트를 골라 vitest를 실행한다
 *
 * - 메뉴: tests/ 아래 *.test.ts가 있는 폴더가 하나의 파트다 (새 폴더를 만들면 자동으로 추가)
 * - 바로 실행: pnpm --filter api test feeds payments   (파트 이름, all이면 전체)
 * - vitest 옵션은 -- 뒤에: pnpm --filter api test payments -- -t "PAY-BE-13"
 * - 터미널이 아니면(CI 등) 메뉴 없이 전체를 실행한다
 * - QA 문서에 BE·AC 줄이 없는 파트(NO_BE_PARTS)는 메뉴에만 있고, 고르면 안내만 보여 준다
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
  delivery: 'DELIVERY · 결과물 전달 · 구매 확정',
  guest: 'GUEST · 비회원 접근 제어',
  quotes: 'QUOTE · 견적 보내기 · 재견적 · 조회',
  inquiry: 'INQUIRY · 문의 · 채팅 · 읽음',
  notifications: 'NOTI · 알림 목록 · 확인 · 읽음 · 생성',
  products: 'PRODUCT · 촬영 상품 추가 · 수정 · 삭제',
  auth: 'AUTH · 가입 · 로그인 · 토큰 갱신 · 로그아웃',
  social: 'SOCIAL · 소셜 가입 · 로그인 · 계정 연결 (제공자 가짜 응답)',
  profile: 'PROFILE · 작가 프로필 · 사진 · 상품 · 리뷰',
  'profile-edit':
    'PROFEDIT · 프로필 기본 정보 수정 · 준비 상태 · 프로필 이미지',
  mypage: 'MYPAGE · 내 정보 · 닉네임 · 비밀번호 변경',
  mypick: 'MYPICK · 좋아요한 사진 · 저장한 작가',
  upload: 'UPLOAD · 사진 업로드 주소 발급 · 등록 (로컬 저장소)',
  manage: 'MANAGE · 포트폴리오 사진 일괄 수정 · 삭제 · 대표 변경',
  detail: 'DETAIL · 사진 상세 · 작가의 다른 사진',
};

// QA 문서에 BE·AC 줄이 없어 서버로 검증할 것이 없는 파트 (화면 동작만 있음)
// 고르면 테스트를 돌리지 않고 안내만 보여 준다
const NO_BE_PARTS: Record<string, { label: string; reason: string }> = {
  imgshare: {
    label: 'IMGSHARE · 사진 공유',
    reason: '공유 주소는 화면에서 만들고, 상세 조회는 DETAIL에서 본다',
  },
  header: {
    label: 'HEADER · 공통 헤더 · 메뉴 · 공통 모달',
    reason: '로그아웃·토큰 갱신은 AUTH, 새 알림 여부는 NOTI에서 본다',
  },
  profshare: {
    label: 'PROFSHARE · 프로필 링크 공유',
    reason: '공유 주소는 화면에서 만들고, 프로필 조회는 PROFILE에서 본다',
  },
};
const NO_BE_MESSAGE = '검증할 BE 로직이 존재하지 않습니다.';

// 메뉴 순서 (QA 문서 목록 순서). 여기에 없는 새 폴더는 맨 뒤에 붙는다
const ORDER = [
  'payments',
  'quotes',
  'inquiry',
  'notifications',
  'products',
  'reservations',
  'auth',
  'reservation-detail',
  'social',
  'cancel',
  'profile',
  'profile-edit',
  'reviews',
  'delivery',
  'mypage',
  'mypick',
  'upload',
  'manage',
  'detail',
  'feeds',
  'header',
  'imgshare',
  'guest',
  'profshare',
];
const orderOf = (name: string) => {
  const index = ORDER.indexOf(name);
  return index === -1 ? ORDER.length : index;
};

const testsDir = new URL('.', import.meta.url);

type Part = { name: string; label: string; fileCount: number; noBe: boolean };

const parts: Part[] = [
  ...readdirSync(testsDir, { withFileTypes: true })
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
      noBe: false,
    })),
  ...Object.entries(NO_BE_PARTS).map(([name, { label }]) => ({
    name,
    label,
    fileCount: 0,
    noBe: true,
  })),
].sort((a, b) => orderOf(a.name) - orderOf(b.name));

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
      `  ${i + 1}) ${part.label}  [${part.name}, ${part.noBe ? 'BE 로직 없음' : `파일 ${part.fileCount}개`}]`,
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

// BE 로직이 없는 파트는 안내만 하고 실행 대상에서 뺀다
const noBeSelected = selected.filter((name) => name in NO_BE_PARTS);
for (const name of noBeSelected) {
  const { label, reason } = NO_BE_PARTS[name]!;
  console.log(`\n${label}: ${NO_BE_MESSAGE}\n  (${reason})`);
}
const runnable = selected.filter((name) => !(name in NO_BE_PARTS));
if (selected.length > 0 && runnable.length === 0) {
  process.exit(0);
}

const targets = runnable.map((name) => `tests/${name}`);
console.log(
  `\n실행: ${runnable.length === 0 ? '전체' : runnable.map((name) => LABELS[name] ?? name).join(', ')}\n`,
);

const result = spawnSync('npx', ['vitest', 'run', ...targets, ...vitestArgs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
