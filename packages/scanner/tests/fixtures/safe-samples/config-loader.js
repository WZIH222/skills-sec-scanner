/**
 * Safe Sample 3: Configuration Loader with Environment Variables
 *
 * This demonstrates safe usage of process.env for configuration.
 * These patterns are NOT vulnerable because:
 * - Environment variables are the standard way to configure Node.js apps
 * - No injection is possible (environment variables are just strings)
 * - No dynamic code execution based on env values
 *
 * Expected findings: None (or info-level only)
 */

// SAFE: Loading configuration from environment variables
function loadConfig() {
  return {
    // Environment variables are the standard way to configure apps
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  };
}

// SAFE: Using environment variables for feature flags
function isFeatureEnabled(featureName) {
  const flag = process.env[`FEATURE_${featureName.toUpperCase()}`];
  return flag === 'true' || flag === '1';
}

// SAFE: Getting secrets from environment (best practice)
function getAWSCredentials() {
  return {
    // This is the RECOMMENDED way to handle credentials
    // (not hardcoded, loaded from environment at runtime)
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
  };
}

// SAFE: Conditional behavior based on environment
function getConfig() {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return {
      debug: false,
      cacheEnabled: true,
      minifyAssets: true
    };
  }

  return {
    debug: true,
    cacheEnabled: false,
    minifyAssets: false
  };
}

// SAFE: API key from environment (not hardcoded)
function getAPIClient() {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error('API_KEY environment variable is required');
  }

  return {
    endpoint: 'https://api.example.com',
    key: apiKey
  };
}

module.exports = {
  loadConfig,
  isFeatureEnabled,
  getAWSCredentials,
  getConfig,
  getAPIClient
};
