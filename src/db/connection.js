import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DATABASE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
//
export const DEFAULT_DATABASE_PATH = path.resolve(
  DATABASE_DIRECTORY,
  '../../data/ticketing.sqlite',
);
const SCHEMA_PATH = new URL('./schema.sql', import.meta.url);

export function createConnection(databasePath = DEFAULT_DATABASE_PATH) {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  return database;
}
