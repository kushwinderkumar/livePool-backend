/**
 * Standalone migration runner.
 * Usage:  npx ts-node src/config/migrate.ts
 *
 * The same schema is also applied automatically on server startup
 * via runMigrations() in index.ts, so you only need this script
 * when you want to run migrations independently (CI, first deploy, etc.)
 */
import fs from 'fs';
import path from 'path';
import { query } from './database';
import dotenv from 'dotenv';

dotenv.config();

const migrate = async (): Promise<void> => {
  console.log('▶  Running database migrations…');

  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await query(sql);
    console.log('✅  Database migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌  Migration failed:', error);
    process.exit(1);
  }
};

migrate();
