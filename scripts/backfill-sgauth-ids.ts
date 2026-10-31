import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { PrismaClient } from '@/prisma/client';

import {
  type BackfillPlan,
  isBackfillClean,
  parseIdMap,
  planSgauthBackfill,
} from '@/lib/sgauth-backfill';

// Fills User.sgauthUserId from the id-map.json SGAuth's `import:aplio --apply`
// writes. Prints Aplio ids and counts only, never an address.
const USAGE =
  'Usage: npm run backfill:sgauth-ids -- --map <id-map.json> (--dry-run | --apply)';

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      map: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      apply: { type: 'boolean', default: false },
    },
  });
  if (!values.map || values['dry-run'] === values.apply) {
    console.error(USAGE);
    process.exit(2);
  }
  return { mapPath: values.map, apply: values.apply };
}

function printPlan(plan: BackfillPlan) {
  const listed: [string, string[]][] = [
    [
      'mismatch (Aplio already holds a different SGAuth id)',
      plan.mismatches.map((m) => m.aplioId),
    ],
    [
      'conflict (SGAuth id claimed by more than one Aplio user)',
      plan.conflicts.map((m) => m.aplioId),
    ],
    ['unknown (mapped Aplio id not in this database)', plan.unknownAplioIds],
    ['unmapped (active Aplio user with no mapping)', plan.unmappedActiveIds],
  ];
  for (const [label, ids] of listed)
    for (const id of ids) console.log(`! ${label}: ${id}`);

  console.log(
    `${plan.updates.length} to set, ${plan.alreadyMapped} already mapped, ` +
      `${plan.mismatches.length} mismatch, ${plan.conflicts.length} conflict, ` +
      `${plan.unknownAplioIds.length} unknown, ${plan.unmappedActiveIds.length} unmapped`,
  );
}

async function main() {
  const { mapPath, apply } = parseCliArgs();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('DATABASE_URL environment variable is not set');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const mappings = parseIdMap(JSON.parse(await readFile(mapPath, 'utf8')));
    const users = await prisma.user.findMany({
      select: { id: true, sgauthUserId: true, deletedAt: true },
    });
    const plan = planSgauthBackfill(mappings, users);
    printPlan(plan);

    if (!apply) {
      console.log('Dry run. Re-run with --apply to write these changes.');
    } else {
      // Guarded on null so a concurrent dual write is never overwritten.
      const written = await prisma.$transaction(
        plan.updates.map((m) =>
          prisma.user.updateMany({
            where: { id: m.aplioId, sgauthUserId: null },
            data: { sgauthUserId: m.sgauthId },
          }),
        ),
      );
      const count = written.reduce((sum, r) => sum + r.count, 0);
      console.log(`Applied: ${count} of ${plan.updates.length} set.`);
    }

    // Records still owned by an active user SGAuth can't resolve yet.
    const user = { deletedAt: null, sgauthUserId: null };
    const [applications, answers, emailLogs] = await Promise.all([
      prisma.application.count({ where: { user } }),
      prisma.globalAnswer.count({ where: { user } }),
      prisma.emailLog.count({ where: { user } }),
    ]);
    console.log(
      `Unresolved after backfill: ${applications} applications, ${answers} answers, ${emailLogs} email logs`,
    );

    const clean =
      isBackfillClean(plan) &&
      (!apply || applications + answers + emailLogs === 0);
    console.log(clean ? 'CLEAN' : 'NOT CLEAN');
    process.exitCode = clean ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
