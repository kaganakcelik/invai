import { DatabaseSync } from 'node:sqlite';
import { config } from '../config';

const db = new DatabaseSync(config.DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function withTransaction(fn: () => void): void {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export default db;
