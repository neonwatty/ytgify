module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  rootDir: '..',
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/utils'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/tests/integration/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/unit/__mocks__/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/unit/__mocks__/setup.ts'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx}',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/**/index.ts',
    '!<rootDir>/src/**/*.test.{ts,tsx}',
    '!<rootDir>/src/**/__tests__/**',
  ],
  coverageDirectory: '<rootDir>/tests/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
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