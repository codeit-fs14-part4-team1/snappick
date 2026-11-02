// src/lib/prisma.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';
import { getDatabaseUrl } from '../config/database-url.js';

//TLS
const usesRds = !process.env.DATABASE_URL;

const connectionConfig: PoolConfig = {
  connectionString: getDatabaseUrl(),
};

if (usesRds) {
  const certificatePath = new URL(
    '../../certs/ap-southeast-2-bundle.pem',
    import.meta.url,
  );

  connectionConfig.ssl = {
    ca: readFileSync(certificatePath, 'utf8'),
    rejectUnauthorized: true,
  };
}

const adapter = new PrismaPg(connectionConfig);

export const prisma = new PrismaClient({ adapter });
