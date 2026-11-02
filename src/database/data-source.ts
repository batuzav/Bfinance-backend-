import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { DataSource, DataSourceOptions } from 'typeorm';
import { InitialSchema1761955200000 } from './migrations/1761955200000-initial-schema';

/**
 * Standalone CLIs (dist/cli/*.js) and Jest's globalSetup do not boot ConfigModule, so nothing
 * loads .env for them. This loader fills ONLY keys that are not already set, which keeps
 * `node --env-file=.env.test …` and shell exports authoritative. Origin: blueprint §19.6.
 */
export function loadDotEnv(path: string = join(process.cwd(), '.env')): void {
  if (!existsSync(path)) {
    return;
  }
  const parsed = parseEnv(readFileSync(path, 'utf8')) as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}

/** Every migration, in order. Append new ones; never edit one that has already run anywhere. */
export const MIGRATIONS = [InitialSchema1761955200000];

/** One options object for the app (TypeOrmModule), the CLIs and the e2e globalSetup. */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [],
    migrations: MIGRATIONS,
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}

/** DataSource for migrations and maintenance CLIs: prefers the direct (non-pooled) URL. */
export function createCliDataSource(): DataSource {
  loadDotEnv();
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL (or DATABASE_URL_DIRECT) is not set: add it to backend/.env or run with --env-file=.env.test',
    );
  }
  return new DataSource(buildDataSourceOptions(url));
}
