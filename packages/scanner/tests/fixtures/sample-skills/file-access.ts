/**
 * Medium threat sample - file system access
 * Should trigger MEDIUM severity finding
 */

import * as fs from 'fs';
import * as path from 'path';

export function writeUserData(fileName: string, content: string): void {
  // MEDIUM: Writing files with user-controlled paths
  // Could overwrite system files
  const filePath = path.join('/tmp', fileName);
  fs.writeFileSync(filePath, content);
}

export function readConfig(configPath: string): string {
  // MEDIUM: Reading files with user-controlled paths
  // Could access sensitive system files
  try {
    return fs.readFileSync(configPath, 'utf-8');
  } catch (error) {
    return '';
  }
}

export function deleteFile(fileName: string): void {
  // MEDIUM: Deleting files with user input
  // Could delete important files
  const filePath = path.join('./uploads', fileName);
  fs.unlinkSync(filePath);
}

export function listFiles(directory: string): string[] {
  // LOW: Listing directory contents
  // Information disclosure risk
  try {
    return fs.readdirSync(directory);
  } catch {
    return [];
  }
}

export function appendLog(logFile: string, message: string): void {
  // MEDIUM: Appending to user-controlled file paths
  fs.appendFileSync(logFile, `${message}\n`);
}

export function createDirectory(dirName: string): void {
  // MEDIUM: Creating directories with user input
  fs.mkdirSync(dirName, { recursive: true });
}
