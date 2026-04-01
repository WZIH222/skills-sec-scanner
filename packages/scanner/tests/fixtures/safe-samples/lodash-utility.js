/**
 * Safe Sample 1: Lodash Utility Functions
 *
 * This demonstrates safe usage of Object.assign and lodash utilities
 * in a utility library context. These patterns are NOT vulnerable because:
 * - Data sources are trusted constants, not user input
 * - No prototype pollution is possible with hardcoded values
 * - Object.assign is used for object composition, not merging user data
 *
 * Expected findings: None (or info-level only)
 */

const _ = require('lodash');

// Safe Object.assign usage: merging constant configuration objects
function mergeConfig() {
  const defaults = {
    debug: false,
    theme: 'light',
    language: 'en'
  };

  const userConfig = {
    theme: 'dark',
    timezone: 'UTC'
  };

  // SAFE: Both sources are constant objects, not user input
  return Object.assign({}, defaults, userConfig);
}

// Safe lodash.merge: combining static option objects
function createOptions() {
  const baseOptions = {
    timeout: 5000,
    retries: 3
  };

  const overrideOptions = {
    timeout: 10000
  };

  // SAFE: No user input involved
  return _.merge({}, baseOptions, overrideOptions);
}

// Safe Object.assign for object cloning
function cloneObject(obj) {
  // SAFE: Simple shallow clone of trusted data
  return Object.assign({}, obj);
}

// Safe lodash utility usage
function pickSafeFields(data) {
  // SAFE: Extracting specific fields from trusted data structure
  return _.pick(data, ['id', 'name', 'email']);
}

module.exports = {
  mergeConfig,
  createOptions,
  cloneObject,
  pickSafeFields
};
