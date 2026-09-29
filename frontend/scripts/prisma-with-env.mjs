import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const moduleResolver = createRequire(import.meta.url);
const { loadEnvConfig } = nextEnv;
const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnvConfig(appDirectory, process.env.NODE_ENV === 'development');

if (process.env.VERCEL !== '1' && !process.env.DATABASE_URL) {
  loadEnvConfig(path.resolve(appDirectory, '..'), process.env.NODE_ENV === 'development');
}

const prismaCli = moduleResolver.resolve('prisma/build/index.js', { paths: [appDirectory] });
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: appDirectory,
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);