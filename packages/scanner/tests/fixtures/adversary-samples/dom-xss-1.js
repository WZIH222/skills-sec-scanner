/**
 * DOM XSS Sample 1: innerHTML with location.search
 *
 * This demonstrates DOM-based cross-site scripting where user input from
 * the URL query string is directly inserted into the DOM using innerHTML
 * without sanitization.
 *
 * CVSS: 8.1 (High)
 * CWE-79
 */

function renderSearchResults() {
  const query = location.search.substring(1);
  const params = new URLSearchParams(query);
  const searchTerm = params.get('q');

  // VULNERABLE: Direct innerHTML assignment with user input
  // Attacker can provide: ?q=<img src=x onerror=alert(1)>
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = `Search results for: ${searchTerm}`;
}

// Alternative vulnerable pattern
function renderHash() {
  // VULNERABLE: Using location.hash without sanitization
  const hash = location.hash.substring(1);
  document.getElementById('content').innerHTML = hash;
}

module.exports = { renderSearchResults, renderHash };
