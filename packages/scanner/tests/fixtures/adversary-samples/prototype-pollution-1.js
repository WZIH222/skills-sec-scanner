/**
 * Prototype Pollution Sample 1: Object.assign with user input
 *
 * This demonstrates a vulnerable pattern where user-controlled input from
 * req.body is merged into an object using Object.assign, which can lead
 * to prototype pollution and potential remote code execution.
 *
 * CVSS: 9.8 (Critical)
 * CWE-1321
 */

function handleUserRequest(req) {
  const config = {
    debug: false,
    admin: false
  };

  // VULNERABLE: Merging user input directly into object
  // Attacker can send: { "__proto__": { "isAdmin": true } }
  const merged = Object.assign(config, req.body);

  if (merged.isAdmin) {
    console.log('Admin access granted');
  }

  return merged;
}

module.exports = { handleUserRequest };
