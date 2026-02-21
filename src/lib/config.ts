/**
 * Application Configuration
 *
 * Centralized config for environment-specific variables.
 * Change ENV to switch between environments for testing.
 */

type Environment = 'dev' | 'qa' | 'prod';

// 👇 Change this to switch environments
const ENV: Environment = 'prod';

// Environment-specific configurations
const configs = {
  dev: {
    APP_URL: 'http://localhost:5173',
    APP_NAME: 'WhoFed (Dev)',
  },
  qa: {
    APP_URL: 'https://whofed-qa.vercel.app', // Update with your QA URL if you have one
    APP_NAME: 'WhoFed (QA)',
  },
  prod: {
    APP_URL: 'https://whofed.me',
    APP_NAME: 'WhoFed',
  },
};

// Export the current environment's config
export const config = configs[ENV];

// Export the current environment name
export const currentEnvironment = ENV;

// Individual exports for convenience
export const APP_URL = config.APP_URL;
export const APP_NAME = config.APP_NAME;
