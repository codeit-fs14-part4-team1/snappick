# SnapPick

원하는 사진 스타일을 탐색하고 사진작가와 연결되는 이미지 기반 스냅 촬영 매칭 서비스입니다.
(코드잇 Part4 1팀 · 구현 기간 2026-10-21 ~ 2026-12-03)

## 팀 문서

규칙과 결정은 팀 Notion에 기록합니다. R&R, 기술 스택, 컨벤션, Git 협업 규칙, 팀 규칙·의사소통, 일정 및 마일스톤 문서를 먼저 읽어 주세요.

## 기술 스택

- 프론트엔드: Next.js (App Router) + TypeScript, Axios, TanStack Query
- 백엔드: Node.js + Express + TypeScript, Prisma
- 데이터베이스: PostgreSQL
- 배포: AWS (세부 구성은 확정 전)

## 폴더 구조 (모노레포 · 1차안)

- apps/web : Next.js 화면
- apps/api : Express API 서버

## 브랜치 · 커밋

- 브랜치: main(배포용), develop(통합용), feat/ · fix/ · chore/ + kebab-case
- 커밋 형식: type: 한글로 작업 내용 (예: feat: 사진 검색 필터 추가)

## 환경 변수

- .env.example만 올리고 실제 .env는 올리지 않습니다.
- 비밀 키는 문서나 코드에 적지 않습니다.
