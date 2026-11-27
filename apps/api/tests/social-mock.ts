import { vi } from 'vitest';

export type SocialProvider = 'KAKAO' | 'NAVER' | 'GOOGLE';

/** 테스트에서 정하는 제공자 계정 */
export type FakeSocialAccount = {
  id: string;
  email?: string | null;
  /** 이메일 인증 여부 (카카오·Google만 응답에 담긴다. 네이버는 이메일이 있으면 인증으로 본다) */
  emailVerified?: boolean;
  nickname?: string | null;
};

const TOKEN_URLS: Record<SocialProvider, string> = {
  KAKAO: 'https://kauth.kakao.com/oauth/token',
  NAVER: 'https://nid.naver.com/oauth2.0/token',
  GOOGLE: 'https://oauth2.googleapis.com/token',
};
const PROFILE_URLS: Record<SocialProvider, string> = {
  KAKAO: 'https://kapi.kakao.com/v2/user/me',
  NAVER: 'https://openapi.naver.com/v1/nid/me',
  GOOGLE: 'https://openidconnect.googleapis.com/v1/userinfo',
};

/** 제공자마다 다른 사용자 정보 응답 모양 */
function profileBody(provider: SocialProvider, account: FakeSocialAccount) {
  const email = account.email ?? undefined;
  const verified = account.emailVerified ?? true;
  switch (provider) {
    case 'KAKAO':
      return {
        id: Number(account.id),
        kakao_account: {
          profile: account.nickname
            ? { nickname: account.nickname }
            : undefined,
          email_needs_agreement: email === undefined,
          ...(email && {
            email,
            is_email_valid: verified,
            is_email_verified: verified,
          }),
        },
      };
    case 'NAVER':
      return {
        resultcode: '00',
        response: {
          id: account.id,
          ...(account.nickname && { nickname: account.nickname }),
          ...(email && { email }),
        },
      };
    case 'GOOGLE':
      return {
        sub: account.id,
        ...(email && { email, email_verified: verified }),
      };
  }
}

/**
 * 카카오·네이버·Google OAuth를 가짜로 바꾼다 (fetch 가로채기)
 * - give(provider, account)로 인가 코드를 하나 발급받아 요청에 넣는다
 * - 인가 코드는 한 번만 쓸 수 있다. 다시 쓰면 토큰 교환에서 400 invalid_grant (실제 제공자와 같은 규칙)
 * - 제공자가 아닌 외부 주소로 요청이 나가면 테스트를 실패시킨다
 */
export function mockSocial() {
  const codes = new Map<
    string,
    { provider: SocialProvider; account: FakeSocialAccount; used: boolean }
  >();
  let seq = 0;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const provider = (Object.keys(TOKEN_URLS) as SocialProvider[]).find(
        (key) =>
          url.startsWith(TOKEN_URLS[key]) || url.startsWith(PROFILE_URLS[key]),
      );
      if (!provider) {
        throw new Error(`테스트 중 외부 요청 차단: ${url}`);
      }

      if (url.startsWith(TOKEN_URLS[provider])) {
        const code =
          new URLSearchParams(String(init?.body ?? '')).get('code') ?? '';
        const entry = codes.get(code);
        if (!entry || entry.provider !== provider || entry.used) {
          return json(400, { error: 'invalid_grant' });
        }
        entry.used = true;
        return json(200, { access_token: `tok_${code}` });
      }

      const auth = new Headers(init?.headers).get('Authorization') ?? '';
      const entry = codes.get(auth.replace(/^Bearer tok_/, ''));
      return entry
        ? json(200, profileBody(provider, entry.account))
        : json(401, { error: 'invalid_token' });
    });

  return {
    /** 이 계정으로 제공자 로그인을 마친 것처럼 인가 코드를 발급한다 */
    give(provider: SocialProvider, account: FakeSocialAccount) {
      const code = `qa_code_${provider}_${++seq}`;
      codes.set(code, { provider, account, used: false });
      return code;
    },
    restore() {
      spy.mockRestore();
    },
  };
}
