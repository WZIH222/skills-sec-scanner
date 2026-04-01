/**
 * DOM XSS Sample 2: outerHTML with document.URL fragment
 *
 * This demonstrates DOM XSS via outerHTML assignment. When user input
 * from document.URL or document.location is inserted into outerHTML,
 * it can lead to XSS.
 *
 * CVSS: 8.1 (High)
 * CWE-79
 */

function updatePageTitle() {
  const url = document.URL;
  const fragment = url.split('#')[1];

  // VULNERABLE: outerHTML with user-controlled fragment
  // Attacker can use: #<img src=x onerror=alert(1)>
  if (fragment) {
    const titleElement = document.getElementById('title');
    titleElement.outerHTML = `<h1 id="title">${fragment}</h1>`;
  }
}

// Another vulnerable pattern with document.cookie
function displayCookie() {
  const cookie = document.cookie;

  // VULNERABLE: Inserting cookie data into DOM
  const welcomeDiv = document.getElementById('welcome');
  welcomeDiv.innerHTML = `<p>Welcome! Your cookie: ${cookie}</p>`;
}

module.exports = { updatePageTitle, displayCookie };
