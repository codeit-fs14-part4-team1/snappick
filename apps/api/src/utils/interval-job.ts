/**
 * 서버 프로세스 안에서 task를 주기적으로 실행한다 (예약 상태 전환 등)
 *
 * - 시작하자마자 1회 실행한다. 서버가 꺼져 있던 동안 밀린 일을 바로 처리하기 위해서다
 * - task가 실패해도 서버가 죽지 않도록 에러는 로그만 남기고 다음 회차에 다시 시도한다
 * - 이전 회차가 아직 끝나지 않았으면 이번 회차는 건너뛴다 (실행 겹침 방지)
 * - 재시작하면 타이머가 사라지므로, task는 "지금 조건에 맞는 것을 처리"하는 형태(멱등)로 작성한다
 *   (특정 시각에 한 번 실행되는 것에 의존하면 그 사이 재시작 때 누락된다)
 *
 * app.ts가 아니라 server.ts에서 등록한다 (테스트·스크립트가 app을 import해도 돌지 않도록)
 * 반환값: 타이머를 멈추는 함수
 */
export function startIntervalJob(
  name: string,
  intervalMs: number,
  task: () => Promise<unknown>,
): () => void {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await task();
    } catch (e) {
      console.error(`[job:${name}] failed`, e);
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => void run(), intervalMs);
  return () => clearInterval(timer);
}
