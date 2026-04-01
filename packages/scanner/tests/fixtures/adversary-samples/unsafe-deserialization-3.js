/**
 * Unsafe Deserialization Sample 3: JSON.parse of API response with __proto__
 *
 * This demonstrates unsafe deserialization of API responses. When external
 * APIs are compromised or return malicious data, parsing without validation
 * can lead to prototype pollution.
 *
 * CVSS: 7.3 (High)
 * CWE-502
 */

async function fetchUserProfile(userId) {
  const response = await fetch(`/api/users/${userId}`);
  const jsonString = await response.text();

  // VULNERABLE: Parsing API response without validation
  // If API is compromised or returns malicious JSON with __proto__
  const profile = JSON.parse(jsonString);

  // This could be polluted
  if (profile.isAdmin) {
    console.log('Admin privileges');
  }

  return profile;
}

// Vulnerable pattern with eval and JSON.parse
function dangerousEvalParse(jsonString) {
  const data = JSON.parse(jsonString);

  // VULNERABLE: eval with parsed data
  // If data contains malicious code in a property, it could execute
  if (data.code) {
    eval(data.code);
  }

  return data;
}

// Vulnerable pattern with Function constructor
function dangerousFunctionConstructor(jsonString) {
  const data = JSON.parse(jsonString);

  // VULNERABLE: Function constructor with parsed data
  if (data.functionBody) {
    const func = new Function(data.functionBody);
    func();
  }

  return data;
}

module.exports = { fetchUserProfile, dangerousEvalParse, dangerousFunctionConstructor };
