/**
 * Test Setup
 * ──────────
 * Loads environment variables for the test environment.
 * Jest runs this before each test file via the `setupFiles` config.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'bankflow_test';
process.env.DB_USER = 'bankflow_admin';
process.env.DB_PASSWORD = 'test_password';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_for_jest';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_for_jest';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.BCRYPT_SALT_ROUNDS = '4'; // Lower rounds for faster tests
