/**
 * Path Traversal Sample 3: fs.writeFile with concatenation of user input
 *
 * This demonstrates path traversal in file write operations, which is
 * even more dangerous as it allows attackers to write arbitrary files
 * to the filesystem, potentially leading to remote code execution.
 *
 * CVSS: 9.1 (Critical)
 * CWE-22
 */

const fs = require('fs');

function saveUserContent(filename, content) {
  // VULNERABLE: Path concatenation without validation
  // Attacker can write to: ../../../../var/www/html/shell.php
  const filepath = '/var/app/uploads/' + filename;

  fs.writeFile(filepath, content, (err) => {
    if (err) {
      console.error('Error writing file:', err);
      return;
    }
    console.log('File saved successfully');
  });
}

// Another vulnerable pattern
function writeConfig(req) {
  const configName = req.body.name;
  const configData = req.body.data;

  // VULNERABLE: Direct use of user input for write path
  // Attacker can write to sensitive system files
  const filepath = `/etc/app/configs/${configName}`;

  fs.writeFileSync(filepath, JSON.stringify(configData));
}

// Vulnerable pattern with directory traversal
function writeLogFile(logEntry) {
  const logFile = '../../../../../var/log/app.log';

  // VULNERABLE: Writing to arbitrary path
  // Attacker can control logEntry and potentially execute code
  fs.appendFileSync(logFile, logEntry + '\n');
}

module.exports = { saveUserContent, writeConfig, writeLogFile };
