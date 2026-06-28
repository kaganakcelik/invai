import 'dotenv/config';
import path from 'path';

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = Object.freeze({
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  GEMINI_API_KEY: require_env('GEMINI_API_KEY'),
  JWT_SECRET: require_env('JWT_SECRET'),
  ADMIN_EMAIL: require_env('ADMIN_EMAIL'),
  ADMIN_PASSWORD: require_env('ADMIN_PASSWORD'),
  DB_PATH: path.resolve(process.env.DB_PATH ?? './invai.db'),
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR ?? './uploads'),
  FLAG_THRESHOLD: parseFloat(process.env.FLAG_THRESHOLD ?? '0.05'),
});
