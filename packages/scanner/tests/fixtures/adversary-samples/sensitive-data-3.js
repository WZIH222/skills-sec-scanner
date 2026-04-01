/**
 * Sensitive Data Exposure Sample 3: Hardcoded GitHub personal access token
 *
 * This demonstrates exposure of GitHub personal access tokens.
 * GitHub tokens follow the pattern: ghp_[a-zA-Z0-9]{36}
 * Also supports GitHub OAuth tokens: gho_[a-zA-Z0-9]{36}
 *
 * CVSS: 9.1 (Critical)
 * CWE-798
 */

// VULNERABLE: Hardcoded GitHub personal access token
const GITHUB_TOKEN = 'ghp_1234567890abcdefghijklmnopqrstuv';

async function fetchGitHubRepo(owner, repo) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  return response.json();
}

// Another vulnerable pattern
const githubConfig = {
  token: 'ghp_9876543210zyxwvutsrqponmlkjihgfedcba',
  username: 'myuser',
  repo: 'myrepo'
};

// Vulnerable pattern with GitHub OAuth
const oauthConfig = {
  clientId: 'Iv1.1a2b3c4d5e6f7g8h',
  clientSecret: 'gho_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t',
  redirectUri: 'http://localhost:3000/callback'
};

// Vulnerable pattern with multiple tokens
const serviceTokens = {
  github: 'ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0',
  gitlab: 'glpat-a1b2c3d4e5f6g7h8i9j0',
  bitbucket: 'ATBB3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0R'
};

async function createGitHubIssue(title, body) {
  const response = await fetch('https://api.github.com/repos/owner/repo/issues', {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, body })
  });

  return response.json();
}

module.exports = {
  fetchGitHubRepo,
  githubConfig,
  oauthConfig,
  serviceTokens,
  createGitHubIssue
};
