import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Bespoke header, corrected in place against a page that hand-rolls its own
// header rather than PageHeader — see components/layouts/page-header.tsx.
const BESPOKE_HEADER_EXCEPTIONS = [
  join('app', '(main)', 'positions', '[id]', 'loading.tsx'),
];
// Owned by a follow-up ticket rewriting this page's tier — leave untouched.
const OWNED_BY_OTHER_TICKET_EXCEPTIONS = [
  join(
    'app',
    '(main)',
    '(auth)',
    'manage',
    'positions',
    '[id]',
    'edit',
    'loading.tsx',
  ),
];

function findLoadingFiles(dir: string, root: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findLoadingFiles(fullPath, root));
    } else if (entry.name === 'loading.tsx') {
      results.push(fullPath.slice(root.length + 1));
    }
  }
  return results;
}

const appDir = join(process.cwd(), 'app');
const loadingFiles = findLoadingFiles(appDir, process.cwd());

describe('loading.tsx skeletons', () => {
  it('finds every route loading.tsx', () => {
    // Guards the guard: a refactor that renames/moves app/ must not silently
    // shrink this list to zero and pass everything by omission.
    expect(loadingFiles.length).toBeGreaterThanOrEqual(14);
  });

  for (const file of loadingFiles) {
    const source = readFileSync(join(process.cwd(), file), 'utf-8');
    const isExempt =
      BESPOKE_HEADER_EXCEPTIONS.includes(file) ||
      OWNED_BY_OTHER_TICKET_EXCEPTIONS.includes(file);

    it(`${file} provides the shell markup itself, not via shared skeletons`, () => {
      expect(source).not.toMatch(/@\/components\/ui\/card/);
      expect(source).not.toMatch(/@\/components\/ui\/table/);
    });

    it(`${file} never hand-draws with animate-pulse`, () => {
      expect(source).not.toMatch(/animate-pulse/);
    });

    if (!isExempt) {
      it(`${file} composes PageHeaderSkeleton`, () => {
        expect(source).toMatch(/PageHeaderSkeleton/);
      });
    }
  }
});
