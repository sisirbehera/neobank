import { z } from 'zod';

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
  })
  .refine((env) => env.NODE_ENV !== 'production' || !!env.MONGODB_URI, {
    message: 'MONGODB_URI is required in production',
    path: ['MONGODB_URI'],
  });

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
