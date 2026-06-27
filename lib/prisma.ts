import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Normalize legacy sslmode aliases to verify-full so pg/pg-connection-string
 * does not emit the v9 deprecation warning. The require/prefer/verify-ca modes
 * are treated identically to verify-full by Neon and current pg versions; this
 * rewrite makes that explicit and silences the warning before it becomes a
 * breaking change in pg v9.
 */
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
