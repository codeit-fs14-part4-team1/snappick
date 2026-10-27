/// <reference types="node" />
import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { getDatabaseUrl } from './src/config/database-url.ts';

//접속 URL의 sslmode, sslcert로 인증서 위치 전달
const databaseUrl = new URL(getDatabaseUrl());
const usesRds = !process.env.DATABASE_URL;

if (usesRds) {
  databaseUrl.searchParams.set('sslmode', 'require');
  databaseUrl.searchParams.set('sslcert', '../certs/ap-southeast-2-bundle.pem');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl.toString(),
  },
});
