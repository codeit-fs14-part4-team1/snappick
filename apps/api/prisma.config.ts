/// <reference types="node" />
import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { getDatabaseUrl } from './src/config/database-url.ts';

//DB환경변수가 없으면 datasource생략
const hasDatabaseEnv = Boolean(process.env.DATABASE_URL || process.env.DB_HOST);

//접속 URL의 sslmode, sslcert로 인증서 위치 전달
const getDatasourceUrl = () => {
  const databaseUrl = new URL(getDatabaseUrl());

  if (!process.env.DATABASE_URL) {
    databaseUrl.searchParams.set('sslmode', 'require');
    databaseUrl.searchParams.set(
      'sslcert',
      '../certs/ap-southeast-2-bundle.pem',
    );
  }
  return databaseUrl.toString();
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(hasDatabaseEnv ? { datasource: { url: getDatasourceUrl() } } : {}),
});
