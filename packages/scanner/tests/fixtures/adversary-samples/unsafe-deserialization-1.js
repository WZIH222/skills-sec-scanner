/**
 * Unsafe Deserialization Sample 1: JSON.parse of POST body without reviver
 *
 * This demonstrates unsafe deserialization where user-controlled JSON
 * is parsed without validation or a reviver function, allowing potential
 * prototype pollution via __proto__ properties.
 *
 * CVSS: 8.6 (High)
 * CWE-502
 */

function handlePostRequest(req) {
  // VULNERABLE: Parsing user input without validation
  const data = JSON.parse(req.body);

  // If attacker sends: { "__proto__": { "admin": true } }
  // This can pollute the prototype chain
  if (data.admin) {
    console.log('Admin access granted');
  }

  return data;
}

// Alternative vulnerable pattern
function parseConfig(jsonString) {
  // VULNERABLE: No validation of parsed data
  const config = JSON.parse(jsonString);

  // Accessing properties without validation
  return config.settings || {};
}

module.exports = { handlePostRequest, parseConfig };
