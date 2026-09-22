import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function readEnvValue(name) {
  const contents = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const match = contents.match(new RegExp(`^${name}=["']?(.*?)["']?$`, 'm'));
  return match?.[1]?.trim();
}

function normalizePostgresUrl(value) {
  if (!value) return value;

  try {
    const parsed = new URL(value);
    if (parsed.hostname) return value;
  } catch {
    // Fall through to support an unescaped password in a local-only .env file.
  }

  const schemeEnd = value.indexOf('://');
  const userEnd = value.indexOf(':', schemeEnd + 3);
  const authEnd = value.lastIndexOf('@');

  if (schemeEnd < 0 || userEnd < 0 || authEnd < 0) return value;

  const password = value.slice(userEnd + 1, authEnd);
  return `${value.slice(0, userEnd + 1)}${encodeURIComponent(password)}${value.slice(authEnd)}`;
}

const [, , command, ...args] = process.argv;
if (!command) {
  console.error('Usage: node scripts/with-db-env.mjs <command> [...args]');
  process.exit(2);
}

const databaseUrl = normalizePostgresUrl(
  process.env.DATABASE_URL || readEnvValue('DATABASE_URL'),
);

const result = spawnSync(command, args, {
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
