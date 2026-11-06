//탐색 세션동안(새로고침전)은 같은 시드를 유지

//보관할변수
let feedSeed: string | null = null;

//씨드생성 (서버와 형식 통일)
function createSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `s_${hex}`;
}

//꺼내어 쓰기
export function getFeedSeed(): string {
  return (feedSeed ??= createSeed());
}
