import { config } from 'dotenv';

config();

export const appConfig = {
  CORS_ORIGIN: (process.env.CORS_ORIGIN || '*').split(',').map((origin) => origin.trim()),
  PAGINATION: {
    DEFAULT_PAGE_SIZE: Number(process.env.DEFAULT_PAGE_SIZE) || 20,
    MAX_PAGE_SIZE: Number(process.env.MAX_PAGE_SIZE) || 100,
  },
  SORTING: {
    MIN_LEVEL: 0,
    MAX_LEVEL: Number(process.env.MAX_SORTING_LEVEL) || 999999,
  },
  SALT_ROUNDS: Number(process.env.PASSWORD_SALT_ROUNDS) || 12,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'access_secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'refresh_secret',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? '60m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
};

export type AppConfig = typeof appConfig;
