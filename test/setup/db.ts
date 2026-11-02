// Shared e2e helper: empties every table between tests. Origin: blueprint §19.6.
// Order does not matter because of CASCADE; the list is every table §4 of the blueprint defines.
import { DataSource } from 'typeorm';

export const ALL_TABLES = [
  'users',
  'auth_identities',
  'refresh_tokens',
  'sync_clients',
  'accounts',
  'rules',
  'transactions',
  'rule_skips',
  'transfers',
] as const;

export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query(`TRUNCATE ${ALL_TABLES.join(', ')} CASCADE`);
}
