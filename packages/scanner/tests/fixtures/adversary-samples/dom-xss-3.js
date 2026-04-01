/**
 * DOM XSS Sample 3: document.write with document.cookie
 *
 * This demonstrates DOM XSS via document.write. When user-controlled
 * data is written to the document using document.write, it can execute
 * malicious scripts.
 *
 * CVSS: 8.1 (High)
 * CWE-79
 */

function writeCookieToDocument() {
  const cookie = document.cookie;

  // VULNERABLE: document.write with cookie data
  // Attacker can set malicious cookie that executes script
  document.write(`<p>Your session: ${cookie}</p>`);
}

// Vulnerable pattern with document.writeln
function writeUserInput(input) {
  // VULNERABLE: Direct document.writeln with user input
  document.writeln(`<div>User said: ${input}</div>`);
}

// Vulnerable pattern with jQuery html() method
function renderWithJQuery($) {
  const userData = location.search;

  // VULNERABLE: jQuery .html() method is equivalent to innerHTML
  $('#output').html(userData);
}

module.exports = { writeCookieToDocument, writeUserInput, renderWithJQuery };
