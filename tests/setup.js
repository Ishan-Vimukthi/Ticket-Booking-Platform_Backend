import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { server as appServer } from '../index.js'; // Import the server instance

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  if (appServer && appServer.close) {
    await new Promise(resolve => appServer.close(resolve)); // Gracefully close the server if it was started
  }
});

beforeEach(async () => {
  // Clear all data from all collections before each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
