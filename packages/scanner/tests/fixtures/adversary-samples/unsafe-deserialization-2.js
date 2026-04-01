/**
 * Unsafe Deserialization Sample 2: JSON.parse of localStorage data
 *
 * This demonstrates unsafe deserialization of data stored in localStorage.
 * Since localStorage can be modified by the user or by malicious scripts,
 * parsing it without validation is dangerous.
 *
 * CVSS: 7.5 (High)
 * CWE-502
 */

function loadUserPreferences() {
  const stored = localStorage.getItem('userPreferences');

  if (stored) {
    // VULNERABLE: Parsing localStorage data without validation
    // Attacker can modify localStorage to include malicious payload
    const prefs = JSON.parse(stored);

    // If polluted, this could execute arbitrary code
    if (prefs.theme) {
      document.body.className = prefs.theme;
    }

    return prefs;
  }

  return {};
}

// Another vulnerable pattern with sessionStorage
function loadSessionData() {
  const sessionData = sessionStorage.getItem('session');

  // VULNERABLE: Parsing sessionStorage without validation
  if (sessionData) {
    return JSON.parse(sessionData);
  }

  return null;
}

module.exports = { loadUserPreferences, loadSessionData };
