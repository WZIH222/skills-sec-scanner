/**
 * Path Traversal Sample 1: fs.readFile with user-provided filename parameter
 *
 * This demonstrates a path traversal vulnerability where user input is used
 * directly in a file read operation without validation, allowing attackers to
 * read arbitrary files on the system.
 *
 * CVSS: 7.5 (High)
 * CWE-22
 */

const fs = require('fs');

function readFile(filename) {
  const filepath = `/var/app/data/${filename}`;

  // VULNERABLE: No validation of filename parameter
  // Attacker can provide: ../../../../etc/passwd
  fs.readFile(filepath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return;
    }
    console.log('File contents:', data);
  });
}

// Another vulnerable pattern
function readUserFile(req) {
  const filename = req.query.file;

  // VULNERABLE: Direct use of user input in file path
  // Attacker can traverse directories using ../ sequences
  fs.readFile(filename, 'utf8', (err, data) => {
    if (!err) {
      res.send(data);
    }
  });
}

module.exports = { readFile, readUserFile };
