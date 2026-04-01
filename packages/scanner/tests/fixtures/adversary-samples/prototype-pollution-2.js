/**
 * Prototype Pollution Sample 2: lodash.merge with query parameter
 *
 * This demonstrates prototype pollution via lodash's deep merge function.
 * When user input from query parameters is merged without validation,
 * attackers can pollute Object.prototype.
 *
 * CVSS: 8.8 (High)
 * CWE-1321
 */

const _ = require('lodash');

function mergeQueryParams(req) {
  const defaults = {
    theme: 'light',
    language: 'en'
  };

  // VULNERABLE: Deep merge with user-controlled query params
  // Attacker can send: ?settings[__proto__][admin]=true
  const merged = _.merge(defaults, req.query.settings);

  // This may now be true due to prototype pollution
  if (Object.prototype.admin === true) {
    console.log('Prototype polluted!');
  }

  return merged;
}

module.exports = { mergeQueryParams };
