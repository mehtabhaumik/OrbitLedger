import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB_ROOT = join(process.cwd(), 'apps/web');
const SCAN_ROOTS = [join(WEB_ROOT, 'app'), join(WEB_ROOT, 'src')];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

describe('web branded dialogs', () => {
  it('does not use native browser alert, confirm, or prompt dialogs', () => {
    const offenders: string[] = [];
    const nativeDialogPattern =
      /\b(?:window|globalThis)\s*\.\s*(?:alert|confirm|prompt)\s*\(|(?<![\w.])alert\s*\(/;

    for (const filePath of SCAN_ROOTS.flatMap(walkFiles)) {
      if (!SOURCE_EXTENSIONS.has(filePath.slice(filePath.lastIndexOf('.')))) {
        continue;
      }
      if (filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      if (nativeDialogPattern.test(source)) {
        offenders.push(relative(process.cwd(), filePath));
      }
    }

    expect(offenders).toEqual([]);
  });
});

function walkFiles(root: string): string[] {
  const entries = readdirSync(root);
  return entries.flatMap((entry) => {
    const filePath = join(root, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      return walkFiles(filePath);
    }
    return [filePath];
  });
}
