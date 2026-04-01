/**
 * Path Traversal Sample 2: fs.readFileSync with query string path
 *
 * This demonstrates synchronous file reading with user-controlled input,
 * allowing path traversal attacks. The synchronous nature makes it
 * particularly dangerous for DoS attacks as well.
 *
 * CVSS: 7.5 (High)
 * CWE-22
 */

const fs = require('fs');

function serveStaticFile(req, res) {
  const filename = req.query.path;

  try {
    // VULNERABLE: Direct use of query parameter in file read
    // Attacker can use: ?path=../../../../etc/passwd
    const content = fs.readFileSync(filename, 'utf8');
    res.send(content);
  } catch (error) {
    res.status(404).send('File not found');
  }
}

// Another vulnerable pattern with path concatenation
function loadConfig(configPath) {
  // VULNERABLE: Concatenating user input without validation
  const fullPath = __dirname + '/config/' + configPath;

  // Attacker can use: ../../../../etc/passwd
  return fs.readFileSync(fullPath, 'utf8');
}

// Vulnerable pattern with URL decoding
function serveDownloadFile(req, res) {
  const filename = decodeURIComponent(req.query.file);

  // VULNERABLE: Decoded path can contain ../ sequences
  // Attacker can URL-encode: ..%2F..%2F..%2Fetc%2Fpasswd
  const content = fs.readFileSync(filename, 'utf8');
  res.send(content);
}

module.exports = { serveStaticFile, loadConfig, serveDownloadFile };
