import mongoose from 'mongoose';

export interface DbConnection {
  disconnect(): Promise<void>;
}

/**
 * Connects Mongoose to MongoDB.
 *
 * Without a URI (local development) it starts an in-memory, single-node
 * replica set so multi-document transactions work exactly as on Atlas.
 * Data in the in-memory database is lost when the API restarts.
 */
export async function connectDb(uri?: string): Promise<DbConnection> {
  let stopMemoryServer: (() => Promise<unknown>) | undefined;

  if (!uri) {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    console.log(
      '[db] MONGODB_URI not set, starting in-memory MongoDB replica set...',
    );
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    uri = replSet.getUri('neobank');
    stopMemoryServer = () => replSet.stop();
  }

  await mongoose.connect(uri);
  // Create collections and indexes up front: MongoDB transactions work best
  // when collections already exist. Models are registered by importing the
  // app (see main.ts), which happens before connectDb() is called.
  await mongoose.connection.syncIndexes();
  console.log(
    `[db] connected to ${mongoose.connection.host}/${mongoose.connection.name}`,
  );

  return {
    async disconnect() {
      await mongoose.disconnect();
      await stopMemoryServer?.();
    },
  };
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
