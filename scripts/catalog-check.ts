#!/usr/bin/env bun
import { join, resolve } from 'path';
import { readdirSync } from 'fs';

interface Issue {
  file: string;
  line: number;
  name: string;
  version: string;
}

async function readJson(file: string) {
  const fileRef = Bun.file(file);
  const s = await fileRef.text();
  const j = await fileRef.json();
  return { json: j, text: s.split(/\r?\n/) };
}

function isAllowedVersion(v: unknown): boolean {
  if (typeof v !== 'string') return true;
  if (v === 'catalog:') return true;
  if (v.startsWith('workspace:')) return true;
  return false;
}

function findLine(
  textLines: string[],
  name: string,
  version: string,
): number | null {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const v = String(version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`"${n}"\\s*:\\s*"${v}"`);
  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i] ?? '';
    if (re.test(line)) return i + 1;
  }
  return null;
}

async function scanFile(file: string): Promise<Issue[]> {
  const { json, text } = await readJson(file);
  const keys = ['dependencies', 'devDependencies', 'optionalDependencies'];
  const issues: Issue[] = [];
  for (const k of keys) {
    const deps = json[k];
    if (!deps) continue;
    for (const [name, version] of Object.entries(deps)) {
      if (!isAllowedVersion(version)) {
        const line = findLine(text, name, version as string) || 0;
        issues.push({ file, line, name, version: version as string });
      }
    }
  }
  return issues;
}

function findPackageJsons(root: string): string[] {
  const targets = [join(root, 'apps'), join(root, 'packages')];
  const out: string[] = [];
  for (const base of targets) {
    // Check if directory exists using fs for sync or Bun.file for async check, but readdirSync needs fs.
    // Or use Bun.Glob? Bun.Glob is cleaner.
    // But keeping logic similar is fine.
    try {
      const stack = [base];
      while (stack.length) {
        const dir = stack.pop()!;
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const p = join(dir, e.name);
            if (e.isDirectory()) {
              if (e.name !== 'node_modules') stack.push(p);
            } else if (e.isFile() && e.name === 'package.json') {
              out.push(p);
            }
          }
        } catch (e) {
          // ignore if dir doesn't exist or permission denied
        }
      }
    } catch (e) {}
  }
  return out;
}

async function main() {
  const root = resolve(import.meta.dir, '..');
  const files = findPackageJsons(root);
  const allIssues: Issue[] = [];
  for (const f of files) {
    if (resolve(f) === join(root, 'package.json')) continue;
    allIssues.push(...(await scanFile(f)));
  }
  if (!allIssues.length) {
    console.log('No hard versions found.');
    return;
  }
  for (const i of allIssues) {
    console.log(`${i.file}:${i.line}: ${i.name} -> ${i.version}`);
  }
  process.exit(1);
}

main();
