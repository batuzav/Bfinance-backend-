// Jest globalSetup for the e2e suite (test/jest-e2e.json). Origin: blueprint §19.6.
// Runs once per `pnpm test:e2e`: wipes the TEST database schema and applies every migration, so each
// run starts from the exact schema in src/database/migrations. Refuses any URL without "_test".
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions, loadDotEnv } from '../../src/database/data-source';

export default async function globalSetup(): Promise<void> {
  loadDotEnv(join(process.cwd(), '.env.test'));
  const url = process.env.DATABASE_URL;
  if (!url || !url.includes('_test')) {
    throw new Error(`e2e refuses to reset a database whose name lacks "_test": ${url ?? '(unset)'}`);
  }
  const dataSource = new DataSource(buildDataSourceOptions(url));
  await dataSource.initialize();
  await dataSource.query('DROP SCHEMA public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.runMigrations();
  await dataSource.destroy();
}
