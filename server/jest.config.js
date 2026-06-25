module.exports = {
  testEnvironment: 'node',
  verbose: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/db/migrations/**',
    '!src/db/seeds/**',
    '!src/db/procedures/**',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: ['**/tests/**/*.test.js'],
  // Increase timeout for integration tests that hit PG/Redis
  testTimeout: 15000,
  // Setup file for environment variables in test mode
  setupFiles: ['./tests/setup.js'],
};
