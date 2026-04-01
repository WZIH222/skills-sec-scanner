/**
 * DOM XSS Threat Sample
 *
 * This sample demonstrates Cross-Site Scripting (XSS) vulnerabilities
 * in DOM manipulation that can lead to malicious script execution.
 *
 * Severity: Medium (context-dependent - client-side only)
 * References:
 * - https://codeql.github.com/docs/codeql-language-guides/data-flow-cheat-sheet-for-javascript/
 * - https://owasp.org/www-community/attacks/DOM_Based_XSS
 */

// Example 1: innerHTML with location.search (Medium)
function displayQueryParams() {
  // Vulnerable: location.search contains user input
  const query = location.search
  const params = new URLSearchParams(query)
  const name = params.get('name') || 'Guest'

  // XSS: innerHTML with untrusted input
  document.getElementById('welcome').innerHTML = `Hello, ${name}!`

  // Attack: ?name=<img src=x onerror=alert(1)>
}

// Example 2: outerHTML with document.URL (Medium)
function updatePageTitle() {
  // Vulnerable: document.URL contains user input
  const url = document.URL
  const fragment = url.split('#')[1]

  if (fragment) {
    // XSS: outerHTML with untrusted input
    const element = document.querySelector('.title')
    element.outerHTML = `<h1 class="title">${fragment}</h1>`
  }

  // Attack: #<h1 onmouseover=alert(1)>Title</h1>
}

// Example 3: document.write with location.hash (Medium)
function writeContent() {
  // Vulnerable: location.hash contains user input
  const hash = location.hash.substring(1)

  // XSS: document.write with untrusted input
  document.write(`<div>${hash}</div>`)

  // Attack: #<img src=x onerror=alert(1)>
}

// Example 4: Multiple DOM sources and sinks
function renderUserProfile() {
  // Sources: location.search, document.URL, document.cookie
  const userId = new URLSearchParams(location.search).get('id')
  const sessionId = document.cookie.match(/session=([^;]+)/)?.[1]
  const referrer = document.referrer

  // Sinks: innerHTML, outerHTML, document.write
  const profileHTML = `
    <div class="profile">
      <span class="user-id">${userId}</span>
      <span class="session">${sessionId}</span>
      <span class="referrer">${referrer}</span>
    </div>
  `

  // XSS: All three sources flow into innerHTML sink
  document.getElementById('profile').innerHTML = profileHTML

  // Attack: ?id=<script>alert(1)</script>
}

// Example 5: DOM XSS via postMessage
window.addEventListener('message', (event) => {
  // Vulnerable: Processing untrusted message data
  const data = event.data

  if (data.type === 'update-content') {
    // XSS: Message content flows into innerHTML
    document.getElementById('content').innerHTML = data.content
  }

  // Attack: postMessage({type: 'update-content', content: '<img src=x onerror=alert(1)>'})
})

// Example 6: jQuery-like HTML manipulation (if using jQuery)
function renderTemplate(template, data) {
  // Vulnerable: Template interpolation with user data
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return data[key] || ''
  })

  // XSS: User data flows into innerHTML
  document.getElementById('app').innerHTML = html

  // Attack: data = {name: '<img src=x onerror=alert(1)>'}
}

// Example 7: Client-side routing vulnerability
function handleRoute() {
  const path = location.pathname
  const params = location.search

  // Vulnerable: Both path and params used unsafely
  const content = `
    <h1>Route: ${path}</h1>
    <p>Parameters: ${params}</p>
  `

  document.getElementById('router').innerHTML = content

  // Attack: /path?<img src=x onerror=alert(1)>
}

// Example 8: localStorage to DOM flow
function displayStoredPreference() {
  // Vulnerable: Stored XSS via localStorage
  const preference = localStorage.getItem('userPreference')

  if (preference) {
    // XSS: Stored data flows into innerHTML
    document.getElementById('pref').innerHTML = preference
  }

  // Attack: localStorage.setItem('userPreference', '<img src=x onerror=alert(1)>')
}

// Example 9: Real-world scenario - URL-based theming
function applyTheme() {
  const theme = new URLSearchParams(location.search).get('theme')

  if (theme) {
    // Vulnerable: Theme parameter flows into style attribute
    const themeStyles = `
      <style>
        body { background-color: ${theme}; }
      </style>
    `
    document.head.innerHTML = themeStyles

    // Attack: ?theme=red</style><img src=x onerror=alert(1)><style>
  }
}

// Example 10: DOM XSS in event handlers
function setupEventHandlers() {
  const eventName = new URLSearchParams(location.search).get('event')

  // Vulnerable: Event name flows into event handler
  const button = document.createElement('button')
  button[`on${eventName}`] = () => {
    console.log('Event triggered')
  }

  // Attack: ?event=error&value=<img src=x onerror=alert(1)>
}

module.exports = {
  displayQueryParams,
  updatePageTitle,
  writeContent,
  renderUserProfile,
  renderTemplate,
  handleRoute,
  displayStoredPreference,
  applyTheme,
  setupEventHandlers
}
