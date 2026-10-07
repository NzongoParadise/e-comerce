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
const prismaArgs = process.argv.slice(2);
const isMigrateDeploy = prismaArgs[0] === 'migrate' && prismaArgs[1] === 'deploy';
const maxAttempts = isMigrateDeploy ? 3 : 1;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = spawnSync(process.execPath, [prismaCli, ...prismaArgs], {
    cwd: appDirectory,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status === 0) process.exit(0);

  const transientAdvisoryLockTimeout = /P1002|timed out trying to acquire.*advisory lock|pg_advisory_lock/i.test(output);
  if (!isMigrateDeploy || !transientAdvisoryLockTimeout || attempt === maxAttempts) {
    process.exit(result.status ?? 1);
  }

  console.warn(`Prisma migration hit the database advisory-lock timeout (attempt ${attempt}/${maxAttempts}); retrying in 5 seconds.`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
