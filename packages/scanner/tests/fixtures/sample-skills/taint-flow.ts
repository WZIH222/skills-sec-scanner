/**
 * Critical threat sample - taint flow tracking
 * Tests parameter -> variable -> eval() sink
 * Should trigger CRITICAL severity with data flow context
 */

export function processUserInput(userInput: string): any {
  // CRITICAL: Taint flow from parameter -> variable -> eval sink
  // Demonstrates taint tracking through variable reassignment
  const data = userInput; // Tainted source
  const transformed = data.trim(); // Taint propagates
  const result = transformed.toLowerCase(); // Taint propagates
  return eval(`(${result})`); // Tainted sink - CRITICAL
}

export function complexTaintFlow(input: string): void {
  // CRITICAL: Multi-step taint propagation
  const step1 = input; // Tainted
  const step2 = Buffer.from(step1).toString('base64'); // Taint propagates
  const step3 = atob(step2); // Taint propagates
  const step4 = decodeURIComponent(step3); // Taint propagates
  const final = step4; // Still tainted
  eval(final); // CRITICAL - tainted eval
}

export function objectTaintFlow(userObj: any): any {
  // CRITICAL: Taint through object properties
  const { command } = userObj; // Tainted source
  const config = { cmd: command }; // Taint propagates
  const cmdString = config.cmd; // Taint propagates
  return eval(cmdString); // CRITICAL - tainted eval
}

export function arrayTaintFlow(inputs: string[]): void {
  // CRITICAL: Taint through array manipulation
  const first = inputs[0]; // Tainted source
  const joined = first.split(',').join(' '); // Taint propagates
  const template = `return ${joined}`; // Taint propagates
  const fn = new Function(template); // CRITICAL - tainted Function constructor
  fn();
}

export function indirectTaint(param: string): void {
  // CRITICAL: Indirect taint flow through function return
  const intermediate = getValue(param); // Tainted via return
  const processed = intermediate + ''; // Taint propagates
  const code = `console.log('${processed}')`; // Taint propagates
  eval(code); // CRITICAL - tainted eval
}

function getValue(val: string): string {
  return val; // Returns tainted value
}
