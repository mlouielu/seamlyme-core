import {Parser} from 'expr-eval';
import type {SeamlyDocument, SeamlyMeasurement} from './types.js';

const parser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    power: true,
    factorial: false,
    concatenate: false,
    conditional: false,
    logical: false,
    comparison: false,
    in: false,
    assignment: false,
  },
});

/**
 * Extracts measurement names referenced in a formula string.
 *
 * @param expr - The formula expression to analyze.
 * @param knownNames - A list of known measurement names to look for.
 * @returns An array of measurement names found in the expression.
 *
 * @example
 * ```typescript
 * import { extractDependencies } from './expressions.js';
 * const deps = extractDependencies('bust_circ + 2', ['bust_circ', 'waist_circ']);
 * ```
 */
export function extractDependencies(
  expr: string,
  knownNames: Iterable<string>,
): string[] {
  const names = [...knownNames].sort((a, b) => b.length - a.length);
  const deps = new Set<string>();

  for (const name of names) {
    const escaped = escapeRegExp(name);
    const re = new RegExp(`(?<![\\w@])${escaped}(?![\\w])`, 'g');
    if (re.test(expr)) deps.add(name);
  }

  for (const custom of findCustomReferences(expr)) {
    deps.add(custom);
  }

  return [...deps].sort();
}

/**
 * Builds a dependency graph for a set of measurements.
 *
 * @param input - Either a Seamly document or a record of measurements.
 * @returns A record where keys are measurement names and values are arrays of their dependencies.
 *
 * @example
 * ```typescript
 * import { buildDependencyGraph } from './expressions.js';
 * const graph = buildDependencyGraph(myDoc);
 * ```
 */
export function buildDependencyGraph(
  input: SeamlyDocument | Record<string, SeamlyMeasurement>,
): Record<string, string[]> {
  const measurements = isDocument(input) ? input.measurements : input;
  const names = Object.keys(measurements);
  return Object.fromEntries(
    Object.entries(measurements).map(([name, measurement]) => [
      name,
      extractDependencies(measurement.raw, names),
    ]),
  );
}

function isDocument(
  input: SeamlyDocument | Record<string, SeamlyMeasurement>,
): input is SeamlyDocument {
  return 'measurements' in input && 'measurementOrder' in input;
}

/**
 * Validates a record of measurements and returns a list of error messages for those that failed to resolve.
 *
 * @param measurements - The measurements to validate.
 * @returns An array of error strings.
 *
 * @example
 * ```typescript
 * import { validateResolvedMeasurements } from './expressions.js';
 * const errors = validateResolvedMeasurements(myDoc.measurements);
 * ```
 */
export function validateResolvedMeasurements(
  measurements: Record<string, SeamlyMeasurement>,
): string[] {
  return Object.values(measurements)
    .filter(measurement => measurement.hasValue && measurement.error)
    .map(measurement => `${measurement.name}: ${measurement.error}`);
}

/**
 * Resolves a set of measurements by evaluating their formulas in dependency order.
 * Handles circular dependency detection and caching of results.
 *
 * @param measurements - The record of measurements to resolve.
 * @returns A new record with resolved values, updated dependencies, and error status.
 *
 * @example
 * ```typescript
 * import { resolveMeasurements } from './expressions.js';
 * const resolved = resolveMeasurements(myDoc.measurements);
 * ```
 */
export function resolveMeasurements(
  measurements: Record<string, SeamlyMeasurement>,
): Record<string, SeamlyMeasurement> {
  const resolved = cloneMeasurements(measurements);
  const graph = buildDependencyGraph(resolved);
  const cache = new Map<string, number | null>();

  for (const measurement of Object.values(resolved)) {
    measurement.dependencies = graph[measurement.name] ?? [];
    measurement.error = null;
  }

  function resolve(name: string, stack: Set<string>): number | null {
    if (cache.has(name)) return cache.get(name) ?? null;

    const measurement = resolved[name];
    if (!measurement) return null;
    if (!measurement.hasValue) {
      cache.set(name, null);
      return null;
    }
    if (stack.has(name)) {
      measurement.error = 'Circular dependency';
      cache.set(name, null);
      return null;
    }

    const raw = measurement.raw.trim();
    const numeric = Number(raw);
    if (raw !== '' && Number.isFinite(numeric)) {
      cache.set(name, numeric);
      return numeric;
    }

    stack.add(name);
    const scope: Record<string, number> = {};
    let expression = raw;
    const deps = [...measurement.dependencies].sort(
      (a, b) => b.length - a.length,
    );
    for (const [index, dep] of deps.entries()) {
      const value = resolve(dep, stack);
      if (value === null) {
        measurement.error = `Unresolved dependency: ${dep}`;
        stack.delete(name);
        cache.set(name, null);
        return null;
      }
      const safeName = `__m${index}`;
      scope[safeName] = value;
      expression = replaceMeasurementReference(expression, dep, safeName);
    }
    stack.delete(name);

    try {
      const value = parser.evaluate(expression, scope);
      const finalValue =
        typeof value === 'number' && Number.isFinite(value) ? value : null;
      measurement.error =
        finalValue === null
          ? 'Expression did not resolve to a finite number'
          : null;
      cache.set(name, finalValue);
      return finalValue;
    } catch (error) {
      measurement.error =
        error instanceof Error ? error.message : 'Invalid expression';
      cache.set(name, null);
      return null;
    }
  }

  for (const name of Object.keys(resolved)) {
    resolved[name].resolved = resolve(name, new Set());
  }

  return resolved;
}

function cloneMeasurements(
  measurements: Record<string, SeamlyMeasurement>,
): Record<string, SeamlyMeasurement> {
  return Object.fromEntries(
    Object.entries(measurements).map(([name, measurement]) => [
      name,
      {
        ...measurement,
        dependencies: [...measurement.dependencies],
      },
    ]),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceMeasurementReference(
  expr: string,
  oldName: string,
  newName: string,
): string {
  const escaped = escapeRegExp(oldName);
  return expr.replace(
    new RegExp(`(?<![\\w@])${escaped}(?![\\w])`, 'g'),
    newName,
  );
}

function findCustomReferences(expr: string): string[] {
  return [...expr.matchAll(/(?<![\w@])@[A-Za-z_][A-Za-z0-9_]*/g)].map(
    match => match[0],
  );
}
