@echo off
chcp 65001 >nul
cd /d "%~dp0.."
call pnpm exec tsx scripts/manual-test.ts
pause
