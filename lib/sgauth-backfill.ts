import { z } from 'zod/v4';

// The id-map.json SGAuth's `import:aplio --apply` writes; extra fields are ignored.
const idMapSchema = z.object({
  mappings: z.array(
    z.object({ aplioId: z.string().min(1), sgauthId: z.string().min(1) }),
  ),
});

export type IdMapping = { aplioId: string; sgauthId: string };

export type BackfillUser = {
  id: string;
  sgauthUserId: string | null;
  deletedAt: Date | null;
};

export type BackfillPlan = {
  updates: IdMapping[];
  alreadyMapped: number;
  mismatches: IdMapping[];
  // sgauthUserId is unique, so an SGAuth id claimed by two Aplio users can't be written.
  conflicts: IdMapping[];
  unknownAplioIds: string[];
  unmappedActiveIds: string[];
};

export function parseIdMap(json: unknown): IdMapping[] {
  return idMapSchema.parse(json).mappings;
}

export function planSgauthBackfill(
  mappings: IdMapping[],
  users: BackfillUser[],
): BackfillPlan {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const plan: BackfillPlan = {
    updates: [],
    alreadyMapped: 0,
    mismatches: [],
    conflicts: [],
    unknownAplioIds: [],
    unmappedActiveIds: [],
  };

  const claims = new Map<string, Set<string>>();
  const claim = (sgauthId: string, aplioId: string) =>
    claims.set(sgauthId, (claims.get(sgauthId) ?? new Set()).add(aplioId));
  for (const user of users)
    if (user.sgauthUserId) claim(user.sgauthUserId, user.id);
  for (const mapping of mappings)
    if (usersById.has(mapping.aplioId))
      claim(mapping.sgauthId, mapping.aplioId);

  const mapped = new Set<string>();
  for (const mapping of mappings) {
    const user = usersById.get(mapping.aplioId);
    if (!user) {
      plan.unknownAplioIds.push(mapping.aplioId);
      continue;
    }
    mapped.add(user.id);

    if (user.sgauthUserId === mapping.sgauthId) plan.alreadyMapped++;
    else if (user.sgauthUserId) plan.mismatches.push(mapping);
    else if ((claims.get(mapping.sgauthId)?.size ?? 0) > 1)
      plan.conflicts.push(mapping);
    else plan.updates.push(mapping);
  }

  for (const user of users)
    if (!user.deletedAt && !user.sgauthUserId && !mapped.has(user.id))
      plan.unmappedActiveIds.push(user.id);

  return plan;
}

// Blocking means the mapping can't be trusted until a person resolves it.
export function isBackfillClean(plan: BackfillPlan): boolean {
  return (
    plan.mismatches.length === 0 &&
    plan.conflicts.length === 0 &&
    plan.unknownAplioIds.length === 0 &&
    plan.unmappedActiveIds.length === 0
  );
}
