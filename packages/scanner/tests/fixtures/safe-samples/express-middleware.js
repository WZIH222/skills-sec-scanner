/**
 * Safe Sample 2: Express Middleware for Static File Serving
 *
 * This demonstrates safe usage of fs.readFile in an Express middleware context.
 * These patterns are NOT vulnerable because:
 * - File paths are validated against an allowlist
 * - Only reads from a known static directory
 * - No user input influences the file path
 *
 * Expected findings: None (or info-level only)
 */

const fs = require('fs');
const path = require('path');

// SAFE: Reading from hardcoded configuration path
function loadAppConfig() {
  const configPath = path.join(__dirname, '../config/app.json');

  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Failed to load config:', err);
      return;
    }

    try {
      const config = JSON.parse(data);
      console.log('Config loaded:', config);
    } catch (parseError) {
      console.error('Failed to parse config:', parseError);
    }
  });
}

// SAFE: Static file serving with path validation
function serveStaticFile(req, res, next) {
  // Only allow specific filenames (allowlist approach)
  const allowedFiles = ['index.html', 'styles.css', 'app.js'];

  const requestedFile = req.params.file;

  // Validate against allowlist
  if (!allowedFiles.includes(requestedFile)) {
    return res.status(403).send('File not allowed');
  }

  // SAFE: Only read files from allowlist
  const filePath = path.join(__dirname, '../public', requestedFile);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).send('File not found');
    }

    res.send(data);
  });
}

// SAFE: Reading package.json (common pattern)
function getPackageVersion() {
  const packagePath = path.join(__dirname, '../package.json');

  fs.readFile(packagePath, 'utf8', (err, data) => {
    if (err) {
      return null;
    }

    const pkg = JSON.parse(data);
    return pkg.version;
  });
}

module.exports = {
  loadAppConfig,
  serveStaticFile,
  getPackageVersion
};
