import fs from 'fs';
import path from 'path';
import db from './client';

export function migrate(): void {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  console.log('Database migrated');
}
