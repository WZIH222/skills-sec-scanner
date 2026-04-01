/**
 * Critical threat sample - eval() with user input
 * Should trigger CRITICAL severity finding
 */

export function executeUserCode(userInput: string): any {
  // CRITICAL: eval() with user input is extremely dangerous
  // Allows arbitrary code execution
  return eval(userInput);
}

export function processExpression(expression: string): number {
  // CRITICAL: eval() with user-controlled expression
  // Could execute malicious code
  return eval(`(${expression})`);
}

export function dangerousCalculator(input: string): any {
  // CRITICAL: eval() with no sanitization
  const code = `return ${input}`;
  const func = new Function(code);
  return func();
}

export function unsafeJsonParser(jsonString: string): any {
  // CRITICAL: eval() instead of JSON.parse
  // Vulnerable to code injection via JSON
  return eval(`(${jsonString})`);
}

export function dynamicImport(modulePath: string): any {
  // HIGH: Dynamic import with user input
  // Could load malicious modules
  return eval(`require('${modulePath}')`);
}
