/// <reference types="node" />
// 인증 API 수동 테스트 도구 (대화형)
//   번호를 고르면 요청 양식을 보여 주고, 값을 직접 입력해서 API를 호출해 볼 수 있습니다.
//   실행: pnpm --filter api manual   (또는 scripts/manual-test.bat 더블클릭)
//   서버를 먼저 띄워 두세요: pnpm dev:api
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

const PORT = process.env.PORT ?? '4000';
const BASE_URL = (process.env.BASE_URL ?? `http://localhost:${PORT}`).replace(
  /\/$/,
  '',
);
const API_DIR = resolve(import.meta.dirname, '..');
const EMAIL_PREFIX = 'manual-'; // 이 도구로 만든 계정을 찾아서 지울 때 쓰는 접두사
const RUN_ID = Date.now();

// 가입 계정을 만들고 DB를 초기화할 수 있는 도구라서 로컬 서버에서만 실행
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
  console.error(`로컬 서버에서만 실행할 수 있습니다. (BASE_URL=${BASE_URL})`);
  process.exit(2);
}

// ---------------------------------------------------------------- 출력 도우미
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
const bold = paint('1');
const dim = paint('2');
const red = paint('31');
const green = paint('32');
const yellow = paint('33');
const cyan = paint('36');

const line = (s = '') => console.log(s);
const indent = (s: string, n = 2) =>
  s
    .split('\n')
    .map((l) => ' '.repeat(n) + l)
    .join('\n');

// 긴 토큰은 앞부분만 보여 줌 (전체 값은 6번 메뉴에서 확인)
const short = (v: string, n = 24) =>
  v.length > n + 8 ? `${v.slice(0, n)}…(${v.length}자)` : v;

function prettyJson(value: unknown): string {
  return JSON.stringify(
    value,
    (key, val) =>
      key === 'access_token' && typeof val === 'string' ? short(val, 36) : val,
    2,
  );
}

// ---------------------------------------------------------------- 입력 도우미
// 줄 단위 입력을 큐에 쌓아 두고 질문할 때 하나씩 꺼내 씀 (직접 입력과 파이프 입력 모두 안정적으로 동작)
class Eof extends Error {}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const queued: string[] = [];
const waiting: Array<(value: string | null) => void> = [];
let closed = false;

rl.on('line', (text) => {
  const next = waiting.shift();
  if (next) next(text);
  else queued.push(text);
});
rl.on('close', () => {
  closed = true;
  while (waiting.length) waiting.shift()?.(null);
});

async function ask(prompt: string): Promise<string> {
  const piped = !process.stdin.isTTY;
  const queuedLine = queued.shift();
  if (queuedLine !== undefined) {
    if (piped) console.log(prompt + queuedLine);
    return queuedLine;
  }
  if (closed) throw new Eof();
  rl.setPrompt(prompt);
  rl.prompt();
  const answer = await new Promise<string | null>((r) => waiting.push(r));
  if (answer === null) throw new Eof();
  if (piped) console.log(answer);
  return answer;
}

// 필드 입력: Enter = 기본값, - = 이 필드를 보내지 않음
async function promptField(
  name: string,
  def: string,
  hint = '',
): Promise<string | undefined> {
  const text = (
    await ask(`  ${name.padEnd(15)}${hint ? dim(hint) + ' ' : ''}[${def}] : `)
  ).trim();
  if (text === '') return def;
  if (text === '-') return undefined;
  return text;
}

async function confirm(question: string, def = false): Promise<boolean> {
  const text = (await ask(`${question} ${def ? '[Y/n]' : '[y/N]'} : `))
    .trim()
    .toLowerCase();
  if (text === '') return def;
  return text === 'y' || text === 'yes';
}

// ---------------------------------------------------------------- 저장된 세션
type Session = {
  accessToken: string | undefined;
  refreshCookie: string | undefined;
  previousRefreshCookie: string | undefined; // 바로 직전에 쓰던 쿠키 (옛 쿠키 재사용 실험용)
  email: string | undefined;
  password: string | undefined;
};
const session: Session = {
  accessToken: undefined,
  refreshCookie: undefined,
  previousRefreshCookie: undefined,
  email: undefined,
  password: undefined,
};
const createdEmails = new Set<string>();

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function accessTokenInfo(): string {
  if (!session.accessToken) return dim('(없음)');
  const payload = decodeJwt(session.accessToken);
  const exp = typeof payload?.exp === 'number' ? payload.exp : undefined;
  const left =
    exp !== undefined
      ? Math.round((exp * 1000 - Date.now()) / 1000)
      : undefined;
  const state =
    left === undefined ? '' : left > 0 ? `남은 ${left}초` : red('만료됨');
  return `${short(session.accessToken, 20)} ${dim(state)}`;
}

// ---------------------------------------------------------------- HTTP
type Result = { status: number; json: unknown; setCookies: string[] } | null;

function maskCookieLine(value: string): string {
  return value.replace(
    /(refresh_token=)([^;]+)/,
    (_m, k: string, v: string) => `${k}${short(v, 12)}`,
  );
}

async function send(
  method: string,
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<Result> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  line(bold('\n▶ 요청'));
  line(`  ${cyan(method)} ${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    const shown =
      lower === 'authorization'
        ? value.replace(
            /(Bearer\s+)(\S+)/i,
            (_m, a: string, t: string) => a + short(t, 20),
          )
        : lower === 'cookie'
          ? maskCookieLine(value)
          : value;
    line(`  ${dim(key + ':')} ${shown}`);
  }
  if (options.body !== undefined) line(indent(prettyJson(options.body)));

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
  } catch {
    line(
      red(
        '\n서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요 (pnpm dev:api).',
      ),
    );
    return null;
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  const setCookies = res.headers.getSetCookie();

  const tone = res.status < 300 ? green : res.status < 500 ? yellow : red;
  line(
    bold('\n◀ 응답') +
      `  ${tone(`${res.status} ${res.statusText}`)}  ${dim(`(${Date.now() - started}ms)`)}`,
  );
  for (const cookie of setCookies)
    line(`  ${dim('Set-Cookie:')} ${maskCookieLine(cookie)}`);
  const cache = res.headers.get('cache-control');
  if (cache) line(`  ${dim('Cache-Control:')} ${cache}`);
  line(
    json === undefined
      ? dim('  (본문 없음)')
      : indent(typeof json === 'string' ? json : prettyJson(json)),
  );

  return { status: res.status, json, setCookies };
}

// 응답에서 토큰을 꺼내 세션에 저장 (이후 메뉴에서 자동으로 사용)
function remember(result: Result): void {
  if (!result) return;
  const notes: string[] = [];

  const token = (result.json as { access_token?: unknown } | undefined)
    ?.access_token;
  if (typeof token === 'string') {
    session.accessToken = token;
    notes.push('access token 저장');
  }

  const raw = result.setCookies.find((c) => c.startsWith('refresh_token='));
  if (raw) {
    const value = raw.split(';')[0]?.slice('refresh_token='.length) ?? '';
    if (value === '') {
      if (session.refreshCookie)
        session.previousRefreshCookie = session.refreshCookie;
      session.refreshCookie = undefined;
      notes.push('refresh 쿠키 삭제 (직전 값은 6번 메뉴에 보관)');
    } else {
      if (session.refreshCookie && session.refreshCookie !== value) {
        session.previousRefreshCookie = session.refreshCookie;
      }
      session.refreshCookie = value;
      notes.push('refresh 쿠키 저장');
    }
  }
  if (notes.length) line(dim(`  ↳ ${notes.join(', ')}`));
}

function put(
  body: Record<string, unknown>,
  key: string,
  value: string | undefined,
) {
  if (value !== undefined) body[key] = value;
}

function title(
  name: string,
  endpoint: string,
  guide: string[],
  tips: string[],
) {
  line(bold(`\n━━ ${name}  ${cyan(endpoint)}`));
  line(dim('  입력 방법: Enter = [기본값] 사용, - = 이 필드를 보내지 않음'));
  for (const g of guide) line(`  ${g}`);
  for (const t of tips) line(yellow(`  💡 ${t}`));
  line();
}

// ---------------------------------------------------------------- 메뉴: API
async function signup() {
  title(
    '회원가입',
    'POST /auth/signup',
    [
      'account_type    USER | PHOTOGRAPHER',
      'provider        BASIC (이메일·비밀번호) | GOOGLE | KAKAO | NAVER (소셜은 아직 501)',
      'provider_email  가입할 이메일 (BASIC)',
      'password        8~16자 (BASIC)',
      'nickname        2~20자',
    ],
    [
      '같은 이메일로 두 번 가입해 보세요 → 409',
      'password에 - 를 입력해 보세요 → 400 (필수 항목 안내)',
      'provider에 GOOGLE을 입력해 보세요 → 501',
    ],
  );
  const body: Record<string, unknown> = {};
  put(
    body,
    'account_type',
    await promptField('account_type', 'USER', 'USER | PHOTOGRAPHER'),
  );
  const provider = await promptField(
    'provider',
    'BASIC',
    'BASIC | GOOGLE | KAKAO | NAVER',
  );
  put(body, 'provider', provider);

  let email: string | undefined;
  let password: string | undefined;
  if (provider === undefined || provider === 'BASIC') {
    email = await promptField(
      'provider_email',
      `${EMAIL_PREFIX}${RUN_ID}@example.com`,
    );
    password = await promptField('password', 'Password123', '8~16자');
    put(body, 'provider_email', email);
    put(body, 'password', password);
  } else {
    put(
      body,
      'provider_token',
      await promptField('provider_token', 'social-token'),
    );
  }
  put(body, 'nickname', await promptField('nickname', 'tester', '2~20자'));

  const result = await send('POST', '/auth/signup', { body });
  remember(result);
  if (result?.status === 201 && email) {
    session.email = email;
    session.password = password;
    createdEmails.add(email.toLowerCase());
    line(dim(`  ↳ 이 계정(${email})은 종료할 때 삭제할 수 있습니다.`));
  }
}

async function login() {
  title(
    '로그인',
    'POST /auth/login',
    [
      'provider        BASIC | GOOGLE | KAKAO | NAVER (소셜은 아직 501)',
      'provider_email 가입한 이메일 / password 가입한 비밀번호',
    ],
    [
      '비밀번호를 틀리게 입력해 보세요 → 401',
      '존재하지 않는 이메일을 입력해 보세요 → 위와 똑같은 401 (계정 존재 여부가 드러나지 않음)',
      '로그인을 여러 번 해 보세요 → 로그인마다 새 세션(family)이 생깁니다',
    ],
  );
  const body: Record<string, unknown> = {};
  const provider = await promptField(
    'provider',
    'BASIC',
    'BASIC | GOOGLE | KAKAO | NAVER',
  );
  put(body, 'provider', provider);
  if (provider === undefined || provider === 'BASIC') {
    put(
      body,
      'provider_email',
      await promptField('provider_email', session.email ?? ''),
    );
    put(
      body,
      'password',
      await promptField('password', session.password ?? 'Password123'),
    );
  } else {
    put(
      body,
      'provider_token',
      await promptField('provider_token', 'social-token'),
    );
  }

  const result = await send('POST', '/auth/login', { body });
  remember(result);
  if (result?.status === 200 && typeof body.provider_email === 'string') {
    session.email = body.provider_email;
    if (typeof body.password === 'string') session.password = body.password;
  }
}

async function me() {
  title(
    '현재 사용자 조회',
    'GET /users/me',
    ['Authorization: Bearer <access token>  (저장된 값을 기본으로 사용)'],
    [
      '- 를 입력해서 토큰 없이 보내 보세요 → 401',
      '토큰 끝을 아무 글자로 바꿔 붙여넣어 보세요 → 401 (변조된 토큰)',
      '로그아웃한 뒤에도 만료 전까지는 200이 나옵니다 (access token은 서버에 저장되지 않음)',
    ],
  );
  const token = await promptField(
    'access token',
    session.accessToken ?? '',
    '(저장된 값)',
  );
  const headers: Record<string, string> = {};
  if (token !== undefined && token !== '')
    headers.Authorization = `Bearer ${token}`;
  await send('GET', '/users/me', { headers });
}

async function refresh() {
  title(
    '토큰 재발급',
    'POST /auth/refresh',
    ['Cookie: refresh_token=<값>  (저장된 쿠키를 기본으로 사용)'],
    [
      '재발급할 때마다 refresh 쿠키가 새 값으로 바뀝니다 (이전 값은 6번 메뉴에 보관)',
      '6번 메뉴에서 "직전 쿠키로 되돌리기"를 한 뒤 재발급해 보세요 → 방금 교체된 쿠키는 10초 안에는 access token만 새로 받습니다',
      '10초 이상 지난 옛 쿠키를 쓰면 401이 나고 그 로그인 세션 전체가 무효화됩니다',
      '- 를 입력해서 쿠키 없이 보내 보세요 → 401',
    ],
  );
  const cookie = await promptField(
    'refresh 쿠키',
    session.refreshCookie ?? '',
    '(저장된 값)',
  );
  const headers: Record<string, string> = {};
  if (cookie !== undefined && cookie !== '')
    headers.Cookie = `refresh_token=${cookie}`;
  remember(await send('POST', '/auth/refresh', { headers }));
}

async function logout() {
  title(
    '로그아웃',
    'POST /auth/logout',
    ['Cookie: refresh_token=<값>  (저장된 쿠키를 기본으로 사용)'],
    [
      '로그아웃한 뒤 같은 쿠키로 재발급을 해 보세요 → 401',
      '쿠키가 없어도, 이미 로그아웃한 쿠키여도 항상 204입니다',
      '다른 로그인 세션(다른 기기)은 로그아웃의 영향을 받지 않습니다',
    ],
  );
  const cookie = await promptField(
    'refresh 쿠키',
    session.refreshCookie ?? '',
    '(저장된 값)',
  );
  const headers: Record<string, string> = {};
  if (cookie !== undefined && cookie !== '')
    headers.Cookie = `refresh_token=${cookie}`;
  remember(await send('POST', '/auth/logout', { headers }));
}

// ---------------------------------------------------------------- 메뉴: 토큰 보관함
async function vault() {
  for (;;) {
    line(bold('\n━━ 저장된 토큰'));
    line(`  access token      ${accessTokenInfo()}`);
    line(
      `  refresh 쿠키      ${session.refreshCookie ? short(session.refreshCookie, 20) : dim('(없음)')}`,
    );
    line(
      `  직전 refresh 쿠키 ${session.previousRefreshCookie ? short(session.previousRefreshCookie, 20) : dim('(없음)')}`,
    );
    line(dim('  1) access token 전체 보기   2) access token 직접 입력/삭제'));
    line(
      dim(
        '  3) refresh 쿠키 직접 입력/삭제   4) 직전 쿠키로 되돌리기 (옛 쿠키 재사용 실험)',
      ),
    );
    line(dim('  5) 모두 비우기   0) 뒤로'));
    const choice = (await ask('> 번호 선택: ')).trim();
    if (choice === '0' || choice === '') return;
    if (choice === '1') {
      line(session.accessToken ?? dim('(없음)'));
      if (session.accessToken) {
        line(dim('  내용: ' + JSON.stringify(decodeJwt(session.accessToken))));
      }
    } else if (choice === '2') {
      const v = (await ask('  새 access token (비우면 삭제): ')).trim();
      session.accessToken = v === '' ? undefined : v;
    } else if (choice === '3') {
      const v = (await ask('  새 refresh 쿠키 값 (비우면 삭제): ')).trim();
      session.refreshCookie = v === '' ? undefined : v;
    } else if (choice === '4') {
      if (!session.previousRefreshCookie) {
        line(
          yellow(
            '  직전 쿠키가 없습니다. 재발급이나 로그인을 한 번 해 보세요.',
          ),
        );
      } else {
        [session.refreshCookie, session.previousRefreshCookie] = [
          session.previousRefreshCookie,
          session.refreshCookie,
        ];
        line(green('  현재 쿠키와 직전 쿠키를 서로 바꿨습니다.'));
      }
    } else if (choice === '5') {
      session.accessToken = undefined;
      session.refreshCookie = undefined;
      session.previousRefreshCookie = undefined;
      line(green('  모두 비웠습니다.'));
    }
  }
}

// ---------------------------------------------------------------- DB 관리
type PrismaLike = typeof import('../src/lib/prisma.js').prisma;
let prismaClient: PrismaLike | undefined;

async function getPrisma(): Promise<PrismaLike> {
  if (!prismaClient) {
    const mod = await import('../src/lib/prisma.js');
    prismaClient = mod.prisma;
  }
  return prismaClient;
}

function dbInfo(): { host: string; name: string } | null {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return { host: url.hostname, name: url.pathname.replace(/^\//, '') };
  } catch {
    return null;
  }
}

function manualAccountFilter() {
  const emails = [...createdEmails];
  return {
    auth_provider: {
      some: {
        OR: [
          { provider_email: { startsWith: EMAIL_PREFIX } },
          ...(emails.length ? [{ provider_email: { in: emails } }] : []),
        ],
      },
    },
  };
}

async function showCounts() {
  const p = await getPrisma();
  const rows: Array<[string, number]> = [
    ['auth_accounts (계정)', await p.auth_accounts.count()],
    ['auth_providers (로그인 수단)', await p.auth_providers.count()],
    ['auth_refresh_tokens (세션 토큰)', await p.auth_refresh_tokens.count()],
    ['users (일반 회원)', await p.users.count()],
    ['photographers (작가)', await p.photographers.count()],
  ];
  const mine = await p.auth_accounts.count({ where: manualAccountFilter() });
  line(bold('\n━━ DB 현황') + dim(`  ${dbInfo()?.host}/${dbInfo()?.name}`));
  // 한글은 터미널에서 너비가 2라서 숫자를 앞에 두어 정렬을 맞춤
  for (const [name, count] of rows)
    line(`  ${String(count).padStart(5)}  ${name}`);
  line(`  ${String(mine).padStart(5)}  이 도구로 만든 계정`);
}

async function deleteMine(): Promise<void> {
  const p = await getPrisma();
  const where = manualAccountFilter();
  const count = await p.auth_accounts.count({ where });
  if (count === 0) {
    line(dim('  삭제할 계정이 없습니다.'));
    return;
  }
  line(
    `  이메일이 "${EMAIL_PREFIX}"로 시작하거나 이번에 가입한 계정 ${bold(String(count))}개를 삭제합니다.`,
  );
  line(
    dim(
      '  (연결된 로그인 수단·프로필·세션 토큰도 함께 삭제됩니다. 시드 계정은 건드리지 않습니다.)',
    ),
  );
  if (!(await confirm('  삭제할까요?', true))) return;
  const done = await p.auth_accounts.deleteMany({ where });
  createdEmails.clear();
  line(green(`  ${done.count}개 삭제했습니다.`));
}

async function resetDatabase(): Promise<void> {
  const info = dbInfo();
  if (
    !info ||
    !['localhost', '127.0.0.1', '::1', '[::1]'].includes(info.host)
  ) {
    line(
      red(
        `  로컬 DB에서만 전체 초기화할 수 있습니다. (현재: ${info?.host ?? '알 수 없음'})`,
      ),
    );
    return;
  }
  line(
    red(
      bold(
        `\n  ⚠ ${info.host}/${info.name} 데이터베이스의 모든 데이터를 삭제하고 마이그레이션을 다시 적용합니다.`,
      ),
    ),
  );
  line(
    dim(
      '  (테스트 계정뿐 아니라 시드 데이터와 팀원이 만든 로컬 데이터도 모두 사라집니다.)',
    ),
  );
  const typed = (
    await ask(
      `  계속하려면 DB 이름 "${info.name}" 을(를) 입력하세요 (취소: Enter): `,
    )
  ).trim();
  if (typed !== info.name) {
    line(dim('  취소했습니다.'));
    return;
  }
  const withSeed = await confirm(
    '  초기화 후 시드(목데이터)를 다시 넣을까요?',
    true,
  );

  if (prismaClient) await prismaClient.$disconnect();
  prismaClient = undefined;

  // 고정된 명령어 문자열을 그대로 실행 (Windows에서는 pnpm이 .cmd라서 shell이 필요)
  const run = (command: string) =>
    spawnSync(command, { cwd: API_DIR, stdio: 'inherit', shell: true });
  const resetCommand = 'pnpm exec prisma migrate reset --force';
  line(dim(`\n  $ ${resetCommand}`));
  if (run(resetCommand).status !== 0) {
    line(red('  초기화에 실패했습니다. 위의 오류 메시지를 확인하세요.'));
    return;
  }
  if (withSeed) {
    const seedCommand = 'pnpm exec prisma db seed';
    line(dim(`\n  $ ${seedCommand}`));
    if (run(seedCommand).status !== 0) line(red('  시드 입력에 실패했습니다.'));
  }
  session.accessToken = undefined;
  session.refreshCookie = undefined;
  session.previousRefreshCookie = undefined;
  session.email = undefined;
  session.password = undefined;
  createdEmails.clear();
  line(green('\n  DB를 초기화했습니다. 저장된 토큰도 비웠습니다.'));
}

async function databaseMenu() {
  for (;;) {
    line(bold('\n━━ 테스트 데이터 / DB'));
    line('  1) DB 현황 보기 (테이블별 행 수)');
    line('  2) 이 도구로 만든 계정만 삭제');
    line('  3) 전체 DB 초기화 (migrate reset, 시드 재입력 선택)');
    line('  0) 뒤로');
    const choice = (await ask('> 번호 선택: ')).trim();
    try {
      if (choice === '0' || choice === '') return;
      if (choice === '1') await showCounts();
      else if (choice === '2') await deleteMine();
      else if (choice === '3') await resetDatabase();
    } catch (error) {
      if (error instanceof Eof) throw error;
      line(
        red(
          `  DB 작업에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      line(dim('  DATABASE_URL과 DB 실행 상태를 확인하세요.'));
    }
  }
}

// ---------------------------------------------------------------- 메인
function printMenu() {
  line(bold('\n══════════════════════════════════════════════════'));
  line(bold(' SnapPick 인증 API 수동 테스트') + dim(`   ${BASE_URL}`));
  line(
    ` 로그인 상태: access token ${accessTokenInfo()} / refresh 쿠키 ${session.refreshCookie ? green('있음') : dim('없음')}`,
  );
  line(bold('══════════════════════════════════════════════════'));
  line('  1) 회원가입        POST /auth/signup');
  line('  2) 로그인          POST /auth/login');
  line('  3) 현재 사용자     GET  /users/me');
  line('  4) 토큰 재발급     POST /auth/refresh');
  line('  5) 로그아웃        POST /auth/logout');
  line('  6) 저장된 토큰 보기/바꾸기');
  line('  7) 테스트 데이터 / DB 초기화');
  line('  0) 종료');
}

async function checkServer() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    line(
      res.ok
        ? green(`서버 연결됨: ${BASE_URL}`)
        : yellow(`서버가 응답했지만 상태가 이상합니다 (${res.status})`),
    );
  } catch {
    line(
      yellow(
        `서버에 연결할 수 없습니다 (${BASE_URL}). 다른 터미널에서 pnpm dev:api 를 실행하세요.`,
      ),
    );
  }
}

async function main() {
  await checkServer();
  try {
    for (;;) {
      printMenu();
      const choice = (await ask('> 번호 선택: ')).trim();
      try {
        if (choice === '0') break;
        else if (choice === '1') await signup();
        else if (choice === '2') await login();
        else if (choice === '3') await me();
        else if (choice === '4') await refresh();
        else if (choice === '5') await logout();
        else if (choice === '6') await vault();
        else if (choice === '7') await databaseMenu();
        else if (choice !== '') line(yellow('  0~7 중에서 선택하세요.'));
      } catch (error) {
        if (error instanceof Eof) throw error;
        line(
          red(
            `  오류: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }

    if (createdEmails.size > 0) {
      line();
      line(`이번에 가입한 계정이 ${createdEmails.size}개 있습니다.`);
      try {
        if (await confirm('종료하기 전에 삭제할까요?', true))
          await deleteMine();
      } catch (error) {
        if (error instanceof Eof) throw error;
        line(
          red(
            `  삭제하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }
  } catch (error) {
    if (!(error instanceof Eof)) throw error;
    line(dim('\n입력이 끝났습니다.'));
  } finally {
    if (prismaClient) await prismaClient.$disconnect();
    rl.close();
  }
  line('종료합니다.');
}

await main();
