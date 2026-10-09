import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let replSet: MongoMemoryReplSet | undefined;

/** Starts a throwaway MongoDB replica set and connects Mongoose to it. */
export async function startTestDb(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri('neobank-test'));
  await mongoose.connection.syncIndexes();
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await replSet?.stop();
}

export async function clearTestDb(): Promise<void> {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all(collections?.map((c) => c.deleteMany({})) ?? []);
}
