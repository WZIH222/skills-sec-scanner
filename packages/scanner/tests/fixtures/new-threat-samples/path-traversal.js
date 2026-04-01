/**
 * Path Traversal Threat Sample
 *
 * This sample demonstrates path traversal vulnerabilities in file operations
 * that can lead to unauthorized file access and data exfiltration.
 *
 * Severity: Medium (context-dependent)
 * References:
 * - https://arxiv.org/html/2505.20186v1
 * - https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2025-68428
 */

const fs = require('fs')
const path = require('path')

// Example 1: fs.readFile with user input (Medium)
function readUserFile(filename) {
  // Vulnerable: No validation of filename parameter
  fs.readFile(filename, 'utf-8', (err, data) => {
    if (err) throw err
    console.log(data)
  })
}

// Attack: filename = '../../../etc/passwd'
readUserFile(userInput)

// Example 2: fs.readFileSync with user input (Medium)
function loadTemplate(templateName) {
  // Vulnerable: Template name not validated
  const templatePath = `./templates/${templateName}`
  return fs.readFileSync(templatePath, 'utf-8')
}

// Attack: templateName = '../../../../../../etc/passwd'
const template = loadTemplate(userInput)

// Example 3: fs.writeFile with user-controlled path (Medium)
function saveContent(content, filename) {
  // Vulnerable: Filename can contain path traversal sequences
  const filepath = `./uploads/${filename}`
  fs.writeFile(filepath, content, (err) => {
    if (err) throw err
    console.log('File saved')
  })
}

// Attack: filename = '../../../../../../tmp/malicious.txt'
saveContent('malicious content', userInput)

// Example 4: File serving in web application (Medium)
const express = require('express')
const app = express()

app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename

  // Vulnerable: No validation of filename parameter
  const filepath = path.join(__dirname, 'public', filename)

  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.status(404).send('File not found')
    } else {
      res.send(data)
    }
  })

  // Attack: /files/../../../../../../etc/passwd
})

// Example 5: Path.join with insufficient validation (Medium)
function getConfigFile(configName) {
  // Vulnerable: path.join doesn't prevent traversal if base path is compromised
  const configPath = path.join('./config', configName)
  return fs.readFileSync(configPath, 'utf-8')
}

// Attack: configName = '../../../../../etc/passwd'
const config = getConfigFile(userInput)

// Example 6: File upload without path sanitization (Medium)
function handleUpload(filename, fileData) {
  // Vulnerable: Filename not sanitized for path traversal
  const uploadPath = `./uploads/${filename}`

  fs.writeFile(uploadPath, fileData, (err) => {
    if (err) throw err
    console.log('File uploaded')
  })

  // Attack: filename = '../../../../../../tmp/malicious.php'
}

// Example 7: Directory traversal in file listing (Medium)
function listFiles(directory) {
  // Vulnerable: Directory parameter not validated
  const dirPath = path.join('./data', directory)

  fs.readdir(dirPath, (err, files) => {
    if (err) throw err
    console.log(files)
  })

  // Attack: directory = '../../../../../../etc'
}

// Example 8: Real-world scenario - profile picture serving
function serveProfilePicture(userId) {
  // Vulnerable: User ID used as filename without validation
  const picturePath = `./uploads/avatars/${userId}.jpg`

  fs.readFile(picturePath, (err, data) => {
    if (err) {
      // Default avatar
      return fs.readFile('./default-avatar.jpg', (err, data) => {
        if (err) throw err
        return data
      })
    }
    return data
  })

  // Attack: userId = '../../../../../etc/passwd'
  // Results in: ./uploads/avatars/../../../../../etc/passwd.jpg
}

// Example 9: Zip extraction without path validation (Medium)
const AdmZip = require('adm-zip')

function extractZip(zipPath, extractTo) {
  const zip = new AdmZip(zipPath)

  // Vulnerable: Zip entries can contain path traversal sequences
  zip.extractAllTo(extractTo, true)

  // Attack: Zip file contains '../../../etc/passwd' as entry
}

// Example 10: Static file serving with root directory (Medium)
function serveStaticFile(reqPath) {
  // Vulnerable: Request path not properly validated
  const fullPath = path.join('./public', reqPath)

  // Check if path starts with public directory (bypassable)
  if (!fullPath.startsWith('./public')) {
    throw new Error('Invalid path')
  }

  return fs.readFileSync(fullPath)

  // Attack: reqPath = 'files/../../../../etc/passwd'
  // Bypasses check if not normalized properly
}

// Example 11: File inclusion in template engine (Medium)
function renderTemplate(templateName, context) {
  // Vulnerable: Template name can include path traversal
  const templatePath = `./views/${templateName}.html`

  const template = fs.readFileSync(templatePath, 'utf-8')

  // Render template with context
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key])

  // Attack: templateName = '../../../../../etc/passwd'
}

// Example 12: Log file injection (Medium)
function writeToLog(message, logFile) {
  // Vulnerable: Log file parameter not validated
  const logPath = `./logs/${logFile}`

  fs.appendFileSync(logPath, `${message}\n`)

  // Attack: logFile = '../../../../../../tmp/malicious.log'
}

// Example 13: Backup file creation (Medium)
function createBackup(filename) {
  // Vulnerable: Filename used in backup path
  const backupPath = `./backups/${filename}.bak`

  fs.copyFile(filename, backupPath, (err) => {
    if (err) throw err
    console.log('Backup created')
  })

  // Attack: filename = '../../../../../../etc/passwd'
  // Creates: ./backups/../../../../../etc/passwd.bak
}

// Example 14: Config file loading with user input (Medium)
function loadUserConfig(username) {
  // Vulnerable: Username used in config path
  const configPath = `./users/${username}/config.json`

  return JSON.parse(fs.readFileSync(configPath, 'utf-8'))

  // Attack: username = '../../admin'
  // Loads: ./users/../../admin/config.json
}

// Example 15: File deletion without validation (Medium)
function deleteFile(filename) {
  // Vulnerable: Filename can include path traversal
  const filepath = `./temp/${filename}`

  fs.unlinkSync(filepath)

  // Attack: filename = '../../../../../important-file.txt'
  // Deletes: ./temp/../../../../../important-file.txt
}

module.exports = {
  readUserFile,
  loadTemplate,
  saveContent,
  getConfigFile,
  handleUpload,
  listFiles,
  serveProfilePicture,
  extractZip,
  serveStaticFile,
  renderTemplate,
  writeToLog,
  createBackup,
  loadUserConfig,
  deleteFile
}
