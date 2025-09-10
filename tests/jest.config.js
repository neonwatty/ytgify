module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/unit'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/unit/__mocks__/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/unit/__mocks__/setup.ts'],
  collectCoverageFrom: [
    '<rootDir>/../src/**/*.{ts,tsx}',
    '!<rootDir>/../src/**/*.d.ts',
    '!<rootDir>/../src/**/index.ts',
  ],
  testTimeout: 5000,
  // Test environment options for Chrome extension testing
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  // Support for async/await in tests
  transformIgnorePatterns: [
    'node_modules/(?!(puppeteer|@puppeteer)/)',
  ],
};