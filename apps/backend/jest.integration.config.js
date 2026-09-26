// Integration tests against a real Postgres started by Testcontainers (requires Docker).
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__/integration'],
  testMatch: ['**/*.int.test.ts'],
  globalSetup: '<rootDir>/src/__tests__/integration/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/integration/setup/globalTeardown.ts',
  // one worker: suites share the container's database and reset it between tests
  maxWorkers: 1,
  testTimeout: 60_000,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        diagnostics: {
          warnOnly: true,
        },
        tsconfig: {
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
