import 'dotenv/config';
import { createApp } from './app';
import { connectDb } from './config/db';
import { loadEnv, toAppConfig } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const db = await connectDb(env.MONGODB_URI);
  const app = createApp(toAppConfig(env));

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(
      `[api] ready on http://${env.HOST}:${env.PORT} (${env.NODE_ENV})`,
    );
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down...`);
    server.close();
    await db.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
