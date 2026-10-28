function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`작성되지 않은 env: ${name}`);
  return value;
}

export const env = {
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  accessTokenTtl: process.env.ACESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 14),
  isProduction: process.env.NODE_ENV === 'production',
};
