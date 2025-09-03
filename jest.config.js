module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts', 
    '!src/**/index.ts',
    '!src/test/**',
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