import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDirectory = path.resolve(appDirectory, '..');
const cleanupTargets = [
  path.join(appDirectory, 'node_modules', '.prisma'),
  path.join(rootDirectory, 'node_modules', '.prisma'),
];

for (const target of cleanupTargets) {
  if (existsSync(target)) {
    try {
      rmSync(target, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Unable to remove stale Prisma cache at ${target}:`, error instanceof Error ? error.message : error);
    }
  }
}

const moduleResolver = createRequire(import.meta.url);
const prismaCli = moduleResolver.resolve('prisma/build/index.js', { paths: [appDirectory] });

const result = spawnSync(process.execPath, [prismaCli, 'generate', '--schema', 'prisma/schema.prisma'], {
  cwd: appDirectory,
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
