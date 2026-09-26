import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../.generated/client';

const connectionString = `${process.env.DATABASE_URL}`;

export class DatabaseClient {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 30_000 });
      DatabaseClient.instance = new PrismaClient({
        adapter,
        log: ['query', 'error', 'warn'],
      });
    }

    return DatabaseClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (DatabaseClient.instance) {
      await DatabaseClient.instance.$disconnect();
    }
  }
}
