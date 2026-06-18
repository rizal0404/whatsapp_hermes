import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_KEY: z.string().min(1, 'API_KEY is required'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
  WA_AUTH_DIR: z.string().default('./auth'),
  QR_TTL_SECONDS: z.coerce.number().default(30),
  MAX_RETRY_ATTEMPTS: z.coerce.number().default(3),
  MESSAGE_JOB_TTL_SECONDS: z.coerce.number().default(3600),
  MAX_FILE_SIZE_MB: z.coerce.number().default(20),
  ALLOWED_FILE_DOMAINS: z.string().transform((val) => val.split(',').map((d) => d.trim())),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }

  return parsed.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
