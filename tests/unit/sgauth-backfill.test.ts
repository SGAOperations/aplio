import { describe, expect, it } from 'vitest';

import {
  isBackfillClean,
  parseIdMap,
  planSgauthBackfill,
} from '@/lib/sgauth-backfill';

const active = (id: string, sgauthUserId: string | null = null) => ({
  id,
  sgauthUserId,
  deletedAt: null,
});

describe('parseIdMap', () => {
  it('reads the mappings and ignores extra fields', () => {
    expect(
      parseIdMap({
        generatedAt: '2026-10-31T00:00:00.000Z',
        sourceSha256: 'abc',
        mappings: [{ aplioId: 'a1', sgauthId: 's1', outcome: 'create' }],
      }),
    ).toEqual([{ aplioId: 'a1', sgauthId: 's1' }]);
  });

  it('rejects a file without mappings', () => {
    expect(() => parseIdMap({ generatedAt: 'x' })).toThrow();
  });
});

describe('planSgauthBackfill', () => {
  it('sets an unmapped user and counts an already-mapped one', () => {
    const plan = planSgauthBackfill(
      [
        { aplioId: 'a1', sgauthId: 's1' },
        { aplioId: 'a2', sgauthId: 's2' },
      ],
      [active('a1'), active('a2', 's2')],
    );
    expect(plan.updates).toEqual([{ aplioId: 'a1', sgauthId: 's1' }]);
    expect(plan.alreadyMapped).toBe(1);
    expect(isBackfillClean(plan)).toBe(true);
  });

  it('flags a dual-written id that disagrees with the map', () => {
    const plan = planSgauthBackfill(
      [{ aplioId: 'a1', sgauthId: 's1' }],
      [active('a1', 'other')],
    );
    expect(plan.mismatches).toHaveLength(1);
    expect(plan.updates).toHaveLength(0);
    expect(isBackfillClean(plan)).toBe(false);
  });

  it('holds back an SGAuth id two Aplio users claim', () => {
    const plan = planSgauthBackfill(
      [
        { aplioId: 'a1', sgauthId: 's1' },
        { aplioId: 'a2', sgauthId: 's1' },
      ],
      [active('a1'), active('a2')],
    );
    expect(plan.conflicts.map((m) => m.aplioId)).toEqual(['a1', 'a2']);
    expect(plan.updates).toHaveLength(0);
  });

  it('holds back an id another user already holds from dual write', () => {
    const plan = planSgauthBackfill(
      [{ aplioId: 'a1', sgauthId: 's1' }],
      [active('a1'), active('a2', 's1')],
    );
    expect(plan.conflicts).toEqual([{ aplioId: 'a1', sgauthId: 's1' }]);
  });

  it('reports unknown mapped ids and unmapped active users', () => {
    const plan = planSgauthBackfill(
      [{ aplioId: 'ghost', sgauthId: 's9' }],
      [active('a1'), { id: 'gone', sgauthUserId: null, deletedAt: new Date() }],
    );
    expect(plan.unknownAplioIds).toEqual(['ghost']);
    expect(plan.unmappedActiveIds).toEqual(['a1']);
  });
});
