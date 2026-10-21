# SnapPick

SnapPick은 사진 스타일 탐색 및 사진작가 예약 플랫폼입니다. 사용자는 사진을 둘러보며 원하는 스타일을 찾고, 그 사진을 찍은 작가에게 견적을 받아 촬영을 예약할 수 있습니다.

> 코드잇 Part 4 1팀 · 구현 기간: 2026-10-21 ~ 2026-12-03

## 목표 기능

다음은 SnapPick이 제공하려는 핵심 사용자 경험입니다. **현재 저장소에는 아직 구현되지 않았으며**, 세부 정책은 개발 과정에서 바뀔 수 있습니다.

- **사진 탐색:** 스타일 태그, 키워드 검색, 정렬로 사진 피드를 탐색
- **작가 포트폴리오:** 작가별 포트폴리오 사진과 촬영 상품 확인
- **견적 및 예약:** 작가와 견적을 주고받고 예약 상태를 확인
- **채팅 및 알림:** 예약 관련 협의와 상태 변경 알림

현재 구현 범위는 [개발 현황](#개발-현황)을 참고해 주세요.

## 기술 스택

이 저장소는 Next.js 웹 애플리케이션과 Express API 서버를 함께 관리하는 pnpm Workspace 모노레포입니다.

| 구분          | 기술                                                              |
| ------------- | ----------------------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), React 19, TypeScript 5, TanStack Query 5 |
| Backend       | Node.js 24, Express 5, TypeScript 5, Prisma 7                     |
| Database      | PostgreSQL                                                        |
| 패키지 매니저 | pnpm 10 Workspace                                                 |
| 코드 품질     | ESLint 9, Prettier 3                                              |
| Git hook      | Husky 9, lint-staged 17, commitlint 21                            |
| CI            | GitHub Actions                                                    |
| 개발 실행     | tsx (API 개발 서버의 watch 실행)                                  |

## 시작하기

### 사전 요구사항

- Node.js `>=24.16.0 <25` (`.nvmrc`: `24.16.0`)
- pnpm `>=10 <11` (`packageManager`: `pnpm@10.34.7`)
- PostgreSQL: 현재 실행에는 필요하지 않습니다. [데이터베이스](#데이터베이스)를 참고해 주세요.

### 1. 저장소 Clone

```bash
git clone https://github.com/codeit-fs14-part4-team1/snappick.git
cd snappick
```

### 2. Node.js 및 pnpm 버전 확인

```bash
node --version
pnpm --version
```

nvm을 사용한다면 저장소 루트에서 `.nvmrc`에 지정된 버전으로 전환할 수 있습니다.

```bash
nvm install
nvm use
```

pnpm이 없거나 버전이 다르다면 npm으로 프로젝트에서 지정한 버전을 설치합니다.

```bash
npm install --global pnpm@10.34.7
```

설치 후 버전을 다시 확인합니다.

```bash
pnpm --version
```

### 3. 의존성 설치

저장소 루트에서 실행합니다.

```bash
pnpm install
```

설치 과정에서 `prepare` 스크립트가 실행되어 Husky Git hook도 함께 설정됩니다.

### 4. 환경변수 설정

각 앱의 `.env.example`을 복사해 로컬 환경변수 파일을 만듭니다.

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

| 앱  | 변수                       | 예시 값                                              | 설명                                 |
| --- | -------------------------- | ---------------------------------------------------- | ------------------------------------ |
| web | `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000`                              | 브라우저에서 요청할 API 서버 주소    |
| api | `PORT`                     | `4000`                                               | API 서버 포트                        |
| api | `DATABASE_URL`             | `postgresql://USER:PASSWORD@localhost:5432/snappick` | PostgreSQL 연결 URL                  |
| api | `ORIGIN`                   | `http://localhost:3000`                              | CORS에서 허용할 웹 애플리케이션 주소 |

환경에 맞게 값을 수정합니다. `.env` 및 `.env.local` 파일은 `.gitignore`에 포함되어 있으며 Git에 커밋하지 않습니다.

### 5. 개발 서버 실행

```bash
pnpm dev
```

기본 환경변수를 사용할 경우 다음 주소에서 실행됩니다.

- Web: http://localhost:3000
- API: http://localhost:4000
- API 상태 확인: http://localhost:4000/health

`/health`는 다음과 같이 응답합니다.

```json
{ "status": "ok", "service": "SnapPick API" }
```

### 데이터베이스

PostgreSQL과 Prisma 설정은 초기 단계입니다.

- `apps/api/prisma/schema.prisma`에는 PostgreSQL datasource와 Prisma Client generator만 정의되어 있고, 데이터 모델과 마이그레이션은 아직 없습니다.
- API 서버는 아직 데이터베이스에 연결하지 않으므로 PostgreSQL 없이도 `pnpm dev`와 `/health` 확인이 가능합니다.
- `DATABASE_URL`은 `apps/api/prisma.config.ts`에서 Prisma CLI가 사용합니다.
- Prisma Client 생성, 마이그레이션, 시드 데이터용 스크립트는 아직 `package.json`에 정의되어 있지 않습니다.

## 프로젝트 구조

```text
snappick/
├── apps/
│   ├── web/                    # Next.js 웹 애플리케이션
│   │   └── src/
│   │       ├── app/            # App Router 페이지, 레이아웃, Provider
│   │       └── lib/            # API 요청 유틸리티
│   └── api/                    # Express API 서버
│       ├── prisma/             # Prisma 스키마
│       ├── prisma.config.ts    # Prisma CLI 설정
│       └── src/                # Express 앱 및 서버 진입점
├── .github/                    # CI 워크플로, Issue 및 PR 템플릿
├── .husky/                     # Git hook
├── commitlint.config.mjs       # 커밋 메시지 규칙
├── lint-staged.config.mjs      # 커밋 전 검사 대상과 명령
├── package.json                # 공통 스크립트와 개발 도구
└── pnpm-workspace.yaml         # Workspace 패키지 범위와 pnpm 설정
```

`pnpm-workspace.yaml`은 `apps/*`와 `packages/*`를 Workspace 패키지로 등록합니다. 각 앱은 자체 `package.json`, TypeScript, ESLint 설정을 가지며, 루트 스크립트는 `pnpm --filter` 또는 `pnpm -r`로 각 앱의 스크립트를 실행합니다.

- `apps/web` (패키지명 `web`): Next.js App Router 기반 웹 애플리케이션입니다. 현재 기본 화면, TanStack Query Provider와 API 요청 유틸리티가 구성되어 있습니다.
- `apps/api` (패키지명 `api`): Express API 애플리케이션입니다. 현재 CORS 및 JSON 미들웨어와 `/health` 엔드포인트가 구성되어 있습니다.
- `packages/*`: 향후 공용 패키지를 위한 경로로 등록되어 있지만, 현재 디렉터리와 공용 패키지는 없습니다.

## 주요 명령어

모든 명령어는 저장소 루트에서 실행합니다.

| 명령어              | 설명                                        |
| ------------------- | ------------------------------------------- |
| `pnpm dev`          | web과 api 개발 서버를 병렬로 실행           |
| `pnpm dev:web`      | web 개발 서버만 실행                        |
| `pnpm dev:api`      | api 개발 서버만 실행                        |
| `pnpm format`       | 저장소 전체 파일을 Prettier로 포맷          |
| `pnpm format:check` | 포맷 변경 없이 Prettier 규칙 준수 여부 확인 |
| `pnpm lint`         | 각 Workspace의 ESLint 검사 실행             |
| `pnpm typecheck`    | 각 Workspace의 TypeScript 타입 검사 실행    |
| `pnpm build`        | 빌드 스크립트가 있는 모든 Workspace 빌드    |

## 개발 및 협업 프로세스

### 브랜치 전략

- `main`: 배포 기준 브랜치
- `develop`: 개발 통합 브랜치
- 작업 브랜치: `develop`에서 분기하고 작업 종류에 맞는 접두사를 사용
  - `feat/<kebab-case>`: 새로운 기능
  - `fix/<kebab-case>`: 버그 수정
  - `chore/<kebab-case>`: 설정, 의존성, 문서 등 기타 작업

### Pull Request

1. 작업 브랜치에서 변경 후 `develop`을 대상으로 Pull Request를 생성합니다.
2. GitHub Actions CI가 포맷, 린트, 타입 검사, 빌드를 실행합니다.
3. 리뷰를 거쳐 `develop`에 병합합니다.
4. 배포할 변경 사항은 검증을 거쳐 `main`에 반영합니다.

병합 전 **CI 통과**와 **리뷰어 최소 2명의 승인**을 받는 것을 팀 협업 정책으로 운영합니다. 이 정책은 현재 GitHub 브랜치 보호 규칙으로 강제되지 않으므로, 병합하는 사람이 직접 조건 충족 여부를 확인합니다.

Issue와 Pull Request는 `.github`의 템플릿(작업 이슈, 버그 이슈, PR)을 사용합니다.

### 커밋 메시지

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 사용합니다.

```text
<type>: <한글 작업 내용>
```

예시:

```text
feat: 사진 검색 필터 추가
fix: API 주소 환경변수 적용 오류 수정
chore: ESLint 설정 정리
```

`type`은 `@commitlint/config-conventional`의 규칙을 따르며 `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`를 사용할 수 있습니다. 한글 제목을 위해 `subject-case` 규칙은 비활성화되어 있습니다.

### 자동 검사

| 도구           | 실행 시점                                       | 역할                                                                                          |
| -------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Husky          | `git commit` 시                                 | `pre-commit`, `commit-msg` hook을 실행                                                        |
| lint-staged    | `pre-commit` hook                               | staged 파일 중 JS/TS에는 ESLint(`--fix`)와 Prettier, JSON·CSS·Markdown·YAML에는 Prettier 적용 |
| commitlint     | `commit-msg` hook                               | 커밋 메시지가 Conventional Commits 형식인지 검사                                              |
| GitHub Actions | `develop`·`main` 대상 PR 및 두 브랜치에 push 시 | `pnpm install --frozen-lockfile` 후 포맷 검사, 린트, 타입 검사, 빌드 실행                     |

Git hook은 로컬 환경에서 실행되며 `--no-verify`로 건너뛸 수 있습니다. GitHub Actions CI는 저장소에서 같은 검사를 다시 실행해 확인합니다.

## 개발 현황

현재 저장소에는 서비스 개발을 위한 기본 환경이 구성되어 있습니다.

- 구성 완료: pnpm Workspace 모노레포, Next.js 웹 앱 초기 구조, Express API 초기 구조와 `/health` 엔드포인트, ESLint·Prettier, Git hook, GitHub Actions CI
- 미구현: [목표 기능](#목표-기능)에 적은 서비스 기능, 데이터 모델과 마이그레이션, 인증, 테스트, 배포 구성

상세한 역할 분담, 일정, 기획 및 기술 결정 문서는 팀 내부 Notion에서 관리하며 외부에 공개되어 있지 않습니다.
