// Loaded by test/jest-e2e.json -> setupFiles, before every e2e spec file. Origin: blueprint §19.6.
// Jest does not boot the shell's env, and ConfigModule ignores .env when NODE_ENV=test, so the e2e
// suite gets its environment from .env.test here. Keys already exported in the shell win.
import { join } from 'node:path';
import { loadDotEnv } from '../../src/database/data-source';

loadDotEnv(join(process.cwd(), '.env.test'));
