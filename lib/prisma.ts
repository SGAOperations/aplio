import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

/** Neon/pg already treat these sslmode aliases as verify-full; explicit silences a pg v9 warning. */
function normalizeConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    const sslmode = parsed.searchParams.get('sslmode');
    if (
      sslmode === 'require' ||
      sslmode === 'prefer' ||
      sslmode === 'verify-ca'
    ) {
      parsed.searchParams.set('sslmode', 'verify-full');
      return parsed.toString();
    }
    return url;
  } catch {
    // Not a valid URL — return as-is so the downstream driver surfaces the error.
    return url;
  }
}

const createPrismaClient = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('DATABASE_URL environment variable is not set');

  const adapter = new PrismaPg({
    connectionString: normalizeConnectionString(databaseUrl),
  });
  return new PrismaClient({ adapter });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
