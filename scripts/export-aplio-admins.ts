import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { PrismaClient } from '@/prisma/client';

import { APLIO_ADMIN_POSITION } from '@/lib/constants';

// One-time handoff: writes current Aplio admins as an SGAuth bulk-import CSV
// (email,name,positions) granting the aplio-admin position. Holds addresses,
// so write it outside the repo or under the gitignored .temp/.
const USAGE = 'Usage: npm run export:aplio-admins -- --out <file.csv>';

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  if (!values.out) {
    console.error(USAGE);
    process.exit(2);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('DATABASE_URL environment variable is not set');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const admins = await prisma.user.findMany({
      where: { isAdmin: true, deletedAt: null },
      select: { email: true, name: true },
      orderBy: { email: 'asc' },
    });
    const rows = admins.map((admin) =>
      [admin.email, admin.name ?? '', APLIO_ADMIN_POSITION]
        .map(csvField)
        .join(','),
    );
    await writeFile(
      values.out,
      ['email,name,positions', ...rows].join('\n') + '\n',
    );
    console.log(`Wrote ${admins.length} admins to ${values.out}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
