import manifest from '@/app/manifest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('manifest', () => {
  const result = manifest();

  it('sets the required PWA fields', () => {
    expect(result.name).toBeTruthy();
    expect(result.short_name).toBeTruthy();
    expect(result.start_url).toBe('/');
    expect(result.display).toBe('standalone');
    expect(result.theme_color).toBeTruthy();
    expect(result.background_color).toBeTruthy();
  });

  it('includes a maskable icon', () => {
    expect(result.icons?.some((icon) => icon.purpose === 'maskable')).toBe(
      true,
    );
  });

  it('points every icon at a file that exists in public/', () => {
    for (const icon of result.icons ?? []) {
      const filePath = join(process.cwd(), 'public', icon.src);
      expect(existsSync(filePath)).toBe(true);
    }
  });
});
