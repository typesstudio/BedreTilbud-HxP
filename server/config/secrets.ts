import { z } from 'zod';

const secretsSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  MISTRAL_API_KEY: z.string().min(1, 'MISTRAL_API_KEY is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  PGHOST: z.string().optional(),
  PGPORT: z.string().optional(),
  PGUSER: z.string().optional(),
  PGPASSWORD: z.string().optional(),
  PGDATABASE: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Secrets = z.infer<typeof secretsSchema>;

export function validateSecrets(): Secrets {
  try {
    const secrets = secretsSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
      SESSION_SECRET: process.env.SESSION_SECRET,
      PGHOST: process.env.PGHOST,
      PGPORT: process.env.PGPORT,
      PGUSER: process.env.PGUSER,
      PGPASSWORD: process.env.PGPASSWORD,
      PGDATABASE: process.env.PGDATABASE,
      NODE_ENV: process.env.NODE_ENV,
    });

    console.log('✅ All required environment secrets validated successfully');
    return secrets;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Missing or invalid required environment variables. Check logs above.');
    }
    throw error;
  }
}

export function getSecret(key: keyof Secrets): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Secret ${key} is not available`);
  }
  return value;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
