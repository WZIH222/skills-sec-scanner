/**
 * Safe Sample 4: File Reader for Trusted Paths
 *
 * This demonstrates safe file reading patterns where paths are
 * predetermined and trusted. These patterns are NOT vulnerable because:
 * - File paths are hardcoded constants or derived from __dirname
 * - No user input influences file paths
 * - All reads are from application's own directory structure
 *
 * Expected findings: None (or info-level only)
 */

const fs = require('fs');
const path = require('path');

// SAFE: Reading own package.json (very common pattern)
function getPackageName() {
  const packagePath = path.join(__dirname, 'package.json');

  const data = fs.readFileSync(packagePath, 'utf8');
  const pkg = JSON.parse(data);

  return pkg.name;
}

// SAFE: Reading from relative path within project
function loadSchema(schemaName) {
  // Only allow specific schema names (allowlist)
  const allowedSchemas = ['user', 'product', 'order'];

  if (!allowedSchemas.includes(schemaName)) {
    throw new Error('Invalid schema name');
  }

  // SAFE: Combining __dirname with allowlisted name
  const schemaPath = path.join(__dirname, '../schemas', `${schemaName}.json`);
  const data = fs.readFileSync(schemaPath, 'utf8');

  return JSON.parse(data);
}

// SAFE: Reading configuration from fixed location
function loadDatabaseConfig() {
  const configPath = path.join(__dirname, '../config/database.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const data = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(data);
}

// SAFE: Template file loading (common in web frameworks)
function loadTemplate(templateName) {
  // Templates are in a known directory
  const templateDir = path.join(__dirname, '../templates');
  const templatePath = path.join(templateDir, `${templateName}.html`);

  // Ensure the resolved path is still within the templates directory
  const normalized = path.normalize(templatePath);
  if (!normalized.startsWith(templateDir)) {
    throw new Error('Invalid template path');
  }

  return fs.readFileSync(normalized, 'utf8');
}

// SAFE: Reading JSON with parse (data is from trusted source)
function readManifest() {
  const manifestPath = path.join(__dirname, '../dist/manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return {};
  }

  const content = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(content);
}

module.exports = {
  getPackageName,
  loadSchema,
  loadDatabaseConfig,
  loadTemplate,
  readManifest
};
