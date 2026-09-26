import type { PrismaClient } from '../../.generated/client';

export type PrismaTxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type PrismaDBClient = PrismaClient | PrismaTxClient;
