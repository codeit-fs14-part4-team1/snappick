import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';

type DatabaseCredentials = {
  username: string;
  password: string;
};

function parseDatabaseCredentials(secret: string): DatabaseCredentials {
  const credentials = JSON.parse(secret) as Partial<DatabaseCredentials>;

  if (!credentials.username || !credentials.password) {
    throw new Error('DB_CREDENTIALS의 형식이 올바르지 않습니다.');
  }

  return {
    username: credentials.username,
    password: credentials.password,
  };
}

//db주소
function getDatabaseUrl(): string {
  //로컬
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  //AWS
  const secret = process.env.DB_CREDENTIALS;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;

  if (!secret || !host || !port || !database) {
    throw new Error('데이터베이스 환경변수가 설정되지 않았습니다.');
  }

  const credentials = parseDatabaseCredentials(secret);

  const url = new URL('postgresql://localhost');
  url.username = credentials.username;
  url.password = credentials.password;
  url.hostname = host;
  url.port = port;
  url.pathname = database;

  // postgresql://사용자명:비밀번호@DB주소:포트/데이터베이스명
  return url.toString();
}

const usesRds = !process.env.DATABASE_URL;

const connectionConfig: PoolConfig = {
  connectionString: getDatabaseUrl(),
};

if (usesRds) {
  const certificatePath = new URL(
    '../../certs/ap-southeast-2-bundle.pem',
    import.meta.url,
  );

  const certificate = readFileSync(certificatePath, 'utf8');

  connectionConfig.ssl = {
    ca: certificate,
    rejectUnauthorized: true,
  };
}

const adapter = new PrismaPg(connectionConfig);

export const prisma = new PrismaClient({ adapter });
