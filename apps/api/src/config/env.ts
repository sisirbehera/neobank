import { z } from 'zod';
import type { AppConfig } from './app-config';

const DEV_ACCESS_SECRET = 'dev-only-access-secret-do-not-use-in-production';

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().default('localhost'),
    PORT: z.coerce.number().int().positive().default(3333),
    /** Leave empty in development to use an in-memory MongoDB replica set. */
    MONGODB_URI: z.string().optional(),
    /** Folder with the built Angular app. Served by Express when it exists. */
    STATIC_DIR: z.string().default('dist/apps/web/browser'),
    APP_VERSION: z.string().default('0.0.0'),
    /** Signs access tokens (JWT, HS256). Long random string in production. */
    JWT_ACCESS_SECRET: z.string().optional(),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    /** Max login/register/refresh requests per IP per 15 minutes. */
    AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !!env.MONGODB_URI, {
    message: 'MONGODB_URI is required in production',
    path: ['MONGODB_URI'],
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      (env.JWT_ACCESS_SECRET?.length ?? 0) >= 32,
    {
      message: 'JWT_ACCESS_SECRET (32+ characters) is required in production',
      path: ['JWT_ACCESS_SECRET'],
    },
  );

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    console.error(
      'Invalid environment variables:\n' + z.prettifyError(result.error),
    );
    process.exit(1);
  }
  return result.data;
}

export function toAppConfig(env: Env): AppConfig {
  return {
    version: env.APP_VERSION,
    staticDir: env.STATIC_DIR,
    auth: {
      accessTokenSecret: env.JWT_ACCESS_SECRET || DEV_ACCESS_SECRET,
      accessTokenTtlMinutes: env.ACCESS_TOKEN_TTL_MINUTES,
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      secureCookies: env.NODE_ENV === 'production',
      rateLimit: env.AUTH_RATE_LIMIT,
    },
  };
}
