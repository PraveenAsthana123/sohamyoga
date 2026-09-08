import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

// 2026-09-08: added for TD-09 (engineering audit) -- this portal had zero
// test infrastructure of any kind. Mirrors sohamyoga-frontend's real,
// working jest.config.ts pattern rather than inventing a new one.
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};

export default createJestConfig(config);
