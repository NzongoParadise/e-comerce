import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.VERCEL_ENV === 'preview') {
  console.log('Skipping database migrations for a Vercel preview deployment.');
  process.exit(0);
}

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationScript = path.join(appDirectory, 'scripts', 'prisma-with-env.mjs');
const result = spawnSync(process.execPath, [
  migrationScript,
  'migrate',
  'deploy',
  '--schema',
  'prisma/schema.prisma',
], {
  cwd: appDirectory,
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
