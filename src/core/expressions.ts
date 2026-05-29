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

  return [...deps].sort();
}

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

export function validateResolvedMeasurements(
  measurements: Record<string, SeamlyMeasurement>,
): string[] {
  return Object.values(measurements)
    .filter(measurement => measurement.hasValue && measurement.error)
    .map(measurement => `${measurement.name}: ${measurement.error}`);
}

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
