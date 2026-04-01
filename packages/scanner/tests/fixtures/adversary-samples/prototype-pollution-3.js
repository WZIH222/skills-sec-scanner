/**
 * Prototype Pollution Sample 3: __proto__ manipulation via constructor.prototype
 *
 * This demonstrates a subtle prototype pollution pattern where the attacker
 * manipulates the prototype chain through constructor.prototype references.
 *
 * CVSS: 7.5 (High)
 * CWE-1321
 */

function parseConfig(input) {
  const obj = {};

  // VULNERABLE: Direct assignment to __proto__ via constructor
  // Attacker can provide input that modifies Object.prototype
  if (input.constructor && input.constructor.prototype) {
    const key = '__proto__';
    obj[key] = input[key];
  }

  // Alternative vulnerable pattern
  const polluted = {};
  polluted.constructor.prototype.polluted = true;

  return polluted;
}

// Another vulnerable pattern: prototype modification via function
function vulnerableFunction() {
  // VULNERABLE: Direct prototype pollution
  this.constructor.prototype.isAdmin = true;
}

module.exports = { parseConfig, vulnerableFunction };
