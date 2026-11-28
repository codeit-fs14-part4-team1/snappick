//APP_SECRETS(JSON 문자열) → 풀어서 process.env에 채움
//없으면 건너뜀(로컬은 .env) → 파싱 → 문자열 값만 → 이미 있는 값은 유지
//server.ts에서 dotenv 다음, app보다 먼저 import

//파싱
function parseAppSecrets(secret: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(secret);
  } catch {
    //에러
    throw new Error('APP_SECRETS의 형식이 올바르지 않습니다.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    //에러
    throw new Error('APP_SECRETS의 형식이 올바르지 않습니다.');
  }

  return parsed as Record<string, unknown>;
}

//채우기
const secret = process.env.APP_SECRETS;

if (secret) {
  Object.entries(parseAppSecrets(secret))
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && process.env[entry[0]] === undefined,
    )
    .forEach(([key, value]) => {
      process.env[key] = value;
    });
}
