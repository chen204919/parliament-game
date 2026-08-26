import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  dbPath: process.env.DB_PATH ?? path.resolve(process.cwd(), 'data/parliament.db'),
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
} as const;
