import 'dotenv/config';
import { createApp } from './app';
import { connectDb } from './config/db';
import { adminCredentials, loadEnv, toAppConfig } from './config/env';
import { DEMO_USERS, ensureAdmin, seedDemoData } from './seed/demo-data';

async function bootstrap() {
  const env = loadEnv();
  const config = toAppConfig(env);
  const db = await connectDb(env.MONGODB_URI);

  if (config.demoDataEnabled) {
    await seedDemoData();
    console.log(
      `[seed] demo login: ${DEMO_USERS.demo.email} / ${DEMO_USERS.demo.password}`,
    );
  }
  const admin = adminCredentials(env);
  if (admin) {
    await ensureAdmin(admin.email, admin.password);
    if (env.NODE_ENV === 'development') {
      console.log(`[seed] admin login: ${admin.email} / ${admin.password}`);
    }
  }

  const app = createApp(config);
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
