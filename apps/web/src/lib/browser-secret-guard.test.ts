import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SOURCE_ROOTS = ['apps/web/app', 'apps/web/src'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const SERVER_SECRET_NAMES = [
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
];

describe('web browser secret guard', () => {
  const sourceFiles = WEB_SOURCE_ROOTS.flatMap((root) => collectSourceFiles(root)).filter(
    (file) => !file.includes('.test.')
  );

  it('does not enable browser-side SDK access for server API keys', () => {
    const offenders = sourceFiles
      .filter((file) => readFileSync(file, 'utf8').includes('dangerouslyAllowBrowser'))
      .map(toRelativePath);

    expect(offenders).toEqual([]);
  });

  it('does not reference server-only secret names in browser source', () => {
    const offenders = sourceFiles
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return SERVER_SECRET_NAMES.filter((secretName) => source.includes(secretName)).map(
          (secretName) => `${toRelativePath(file)} -> ${secretName}`
        );
      });

    expect(offenders).toEqual([]);
  });

  it('does not print keys, secrets, or tokens from web code', () => {
    const consolePattern = /console\.(log|info|warn|error|debug)\s*\(([^)]*(api[_-]?key|apikey|secret|token|credential|password|razorpay|resend)[^)]*)\)/gi;
    const offenders = sourceFiles
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return Array.from(source.matchAll(consolePattern)).map(
          (match) => `${toRelativePath(file)} -> ${match[0].replace(/\s+/g, ' ').slice(0, 120)}`
        );
      });

    expect(offenders).toEqual([]);
  });
});

function collectSourceFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }

    if (SOURCE_EXTENSIONS.has(getExtension(path))) {
      files.push(path);
    }
  }

  return files;
}

function getExtension(path: string) {
  const dotIndex = path.lastIndexOf('.');
  return dotIndex >= 0 ? path.slice(dotIndex) : '';
}

function toRelativePath(path: string) {
  return path.replace(`${process.cwd()}/`, '');
}
