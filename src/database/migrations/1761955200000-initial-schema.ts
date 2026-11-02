import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema — blueprint §4 verbatim. Hand-authored (this project never runs
 * `typeorm migration:generate`). Additive-only from here on: offline phones may be months old.
 * "interval" is always double-quoted because it is an SQL keyword.
 */
export class InitialSchema1761955200000 implements MigrationInterface {
  name = 'InitialSchema1761955200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE sync_seq AS bigint START WITH 1`);

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
        password_hash text NULL,
        timezone text NOT NULL DEFAULT 'America/Mazatlan',
        currency char(3) NOT NULL DEFAULT 'MXN',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX users_email_key ON users (email)`);

    await queryRunner.query(`
      CREATE TABLE auth_identities (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        provider text NOT NULL CHECK (provider IN ('google', 'apple')),
        provider_user_id text NOT NULL,
        email_verified boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider, provider_user_id)
      )`);

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        family_id uuid NOT NULL,
        token_hash char(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        replaced_by uuid NULL,
        user_agent text NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id)`);
    await queryRunner.query(`CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id)`);

    await queryRunner.query(`
      CREATE TABLE sync_clients (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        device_label text NULL,
        last_seen_at timestamptz NOT NULL DEFAULT now()
      )`);

    await queryRunner.query(`
      CREATE TABLE accounts (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
        kind text NOT NULL CHECK (kind IN ('cash', 'debit', 'credit', 'savings')),
        currency char(3) NOT NULL DEFAULT 'MXN' CHECK (currency = 'MXN'),
        opening_cents bigint NOT NULL DEFAULT 0 CHECK (opening_cents >= 0 AND opening_cents <= 999999999),
        cut_day smallint NULL CHECK (cut_day BETWEEN 1 AND 31),
        pay_day smallint NULL CHECK (pay_day BETWEEN 1 AND 31),
        note text NULL CHECK (length(note) <= 120),
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz NULL,
        server_seq bigint NOT NULL DEFAULT nextval('sync_seq'),
        UNIQUE (user_id, id)
      )`);
    await queryRunner.query(`CREATE INDEX accounts_user_seq_idx ON accounts (user_id, server_seq)`);

    await queryRunner.query(`
      CREATE TABLE rules (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        type text NOT NULL CHECK (type IN ('expense', 'income', 'payment')),
        amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
        label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
        account_id uuid NOT NULL,
        target_account_id uuid NULL,
        category text NULL CHECK (length(category) <= 40),
        frequency text NOT NULL CHECK (frequency IN ('weekly', 'semimonthly', 'monthly', 'yearly')),
        "interval" smallint NOT NULL DEFAULT 1 CHECK ("interval" = 1),
        day_of_month smallint NULL CHECK (day_of_month BETWEEN 1 AND 31),
        month_of_year smallint NULL CHECK (month_of_year BETWEEN 1 AND 12),
        weekday smallint NULL CHECK (weekday BETWEEN 0 AND 6),
        start_on date NOT NULL,
        end_on date NULL,
        max_count integer NULL CHECK (max_count > 0),
        status text NOT NULL CHECK (status IN ('active', 'paused', 'ended')),
        last_materialized_on date NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz NULL,
        server_seq bigint NOT NULL DEFAULT nextval('sync_seq'),
        UNIQUE (user_id, id),
        CONSTRAINT rules_payment_target CHECK ((type = 'payment') = (target_account_id IS NOT NULL)),
        CONSTRAINT rules_weekly_fields CHECK (frequency <> 'weekly' OR weekday IS NOT NULL),
        CONSTRAINT rules_monthly_fields CHECK (frequency <> 'monthly' OR day_of_month IS NOT NULL),
        CONSTRAINT rules_yearly_fields CHECK (frequency <> 'yearly' OR (day_of_month IS NOT NULL AND month_of_year IS NOT NULL)),
        CONSTRAINT rules_end_after_start CHECK (end_on IS NULL OR end_on >= start_on),
        FOREIGN KEY (user_id, account_id) REFERENCES accounts (user_id, id) ON DELETE CASCADE,
        FOREIGN KEY (user_id, target_account_id) REFERENCES accounts (user_id, id) ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX rules_user_seq_idx ON rules (user_id, server_seq)`);

    await queryRunner.query(`
      CREATE TABLE transactions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        type text NOT NULL CHECK (type IN ('expense', 'income', 'payment')),
        amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
        label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
        account_id uuid NOT NULL,
        target_account_id uuid NULL,
        category text NULL CHECK (length(category) <= 40),
        occurred_on date NOT NULL,
        rule_id uuid NULL,
        occurrence_on date NULL,
        edited_at timestamptz NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz NULL,
        server_seq bigint NOT NULL DEFAULT nextval('sync_seq'),
        CONSTRAINT transactions_payment_target CHECK ((type = 'payment') = (target_account_id IS NOT NULL)),
        CONSTRAINT transactions_rule_pair CHECK ((rule_id IS NULL) = (occurrence_on IS NULL)),
        FOREIGN KEY (user_id, account_id) REFERENCES accounts (user_id, id) ON DELETE CASCADE,
        FOREIGN KEY (user_id, target_account_id) REFERENCES accounts (user_id, id) ON DELETE CASCADE,
        FOREIGN KEY (user_id, rule_id) REFERENCES rules (user_id, id) ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX transactions_user_seq_idx ON transactions (user_id, server_seq)`);
    await queryRunner.query(`CREATE INDEX transactions_user_occurred_idx ON transactions (user_id, occurred_on)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX transactions_rule_occurrence_key ON transactions (user_id, rule_id, occurrence_on) WHERE rule_id IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE rule_skips (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        rule_id uuid NOT NULL,
        occurrence_on date NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz NULL,
        server_seq bigint NOT NULL DEFAULT nextval('sync_seq'),
        UNIQUE (user_id, rule_id, occurrence_on),
        FOREIGN KEY (user_id, rule_id) REFERENCES rules (user_id, id) ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX rule_skips_user_seq_idx ON rule_skips (user_id, server_seq)`);

    await queryRunner.query(`
      CREATE TABLE transfers (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('withdrawal', 'deposit')),
        from_account_id uuid NOT NULL,
        to_account_id uuid NOT NULL,
        amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
        label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
        occurred_on date NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz NULL,
        server_seq bigint NOT NULL DEFAULT nextval('sync_seq'),
        CONSTRAINT transfers_distinct_accounts CHECK (from_account_id <> to_account_id),
        FOREIGN KEY (user_id, from_account_id) REFERENCES accounts (user_id, id) ON DELETE CASCADE,
        FOREIGN KEY (user_id, to_account_id) REFERENCES accounts (user_id, id) ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX transfers_user_seq_idx ON transfers (user_id, server_seq)`);
    await queryRunner.query(`CREATE INDEX transfers_user_occurred_idx ON transfers (user_id, occurred_on)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS transfers`);
    await queryRunner.query(`DROP TABLE IF EXISTS rule_skips`);
    await queryRunner.query(`DROP TABLE IF EXISTS transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS rules`);
    await queryRunner.query(`DROP TABLE IF EXISTS accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS sync_clients`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_identities`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS sync_seq`);
  }
}
