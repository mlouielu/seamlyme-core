import {
  lookupSeamlyMeasurement,
  SEAMLY_BY_ID,
  SEAMLY_BY_VAR,
} from './catalog.js';
import {NAMED_TEMPLATES} from './default-formulas.js';
import {buildDependencyGraph, resolveMeasurements} from './expressions.js';
import {parseSmis} from './smis.js';
import type {
  CreateDocumentOptions,
  MeasurementMetaPatch,
  MeasurementMoveDirection,
  NameConflictResolution,
  DocumentPatch,
  MeasurementRow,
  SeamlyDocument,
  SeamlyMeasurement,
  SeamlyMultisizeMeasurement,
  ValidationIssue,
} from './types.js';

/**
 * Creates a new SeamlyDocument without needing to provide XML.
 *
 * - Default (no options): all 256 catalog entries with empty values.
 * - `empty: true`: completely empty, no measurements.
 * - `template: 'default'`: catalog entries with built-in default formulas pre-filled.
 * - `template: './path.smis'`: catalog entries overlaid with values from a file.
 *
 * @param options - Document creation options.
 * @returns A new SeamlyDocument.
 *
 * @example
 * ```typescript
 * import { createDocument } from './document.js';
 *
 * const blank = createDocument();
 * const empty = createDocument({ empty: true });
 * const withDefaults = createDocument({ unit: 'inch', template: 'default' });
 * ```
 */
export function createDocument(
  options: CreateDocumentOptions = {},
): SeamlyDocument {
  const {
    type = 'individual',
    unit = 'cm',
    notes = '',
    readOnly = false,
    pmSys = '998',
    personal = {},
    multisize: multisizeOpts = {},
    empty = false,
    template,
    defaultValue,
  } = options;

  const root = type === 'multisize' ? 'smms' : 'smis';
  const parts = [
    `<${root}>`,
    `<unit>${escapeXml(unit)}</unit>`,
    `<read-only>${readOnly}</read-only>`,
    `<notes>${escapeXml(notes)}</notes>`,
    `<pm_system>${escapeXml(pmSys)}</pm_system>`,
  ];

  if (type === 'individual') {
    parts.push(
      '<personal>',
      `<given-name>${escapeXml(personal['given-name'] ?? '')}</given-name>`,
      `<family-name>${escapeXml(personal['family-name'] ?? '')}</family-name>`,
      `<birth-date>${escapeXml(personal['birth-date'] ?? '')}</birth-date>`,
      `<gender>${escapeXml(personal.gender ?? '')}</gender>`,
      `<email>${escapeXml(personal.email ?? '')}</email>`,
      '</personal>',
    );
  }

  if (type === 'multisize') {
    parts.push('<size>', String(multisizeOpts.baseSize ?? ''), '</size>');
    parts.push('<height>', String(multisizeOpts.baseHeight ?? ''), '</height>');
  }

  parts.push(`</${root}>`);
  const xml = parts.join('');

  const doc = parseSmis(xml, {type, includeCatalog: !empty});

  if (template) {
    const formulas =
      typeof template === 'string'
        ? (NAMED_TEMPLATES[template] ?? {})
        : template;
    for (const [name, formula] of Object.entries(formulas)) {
      if (doc.measurements[name]) {
        doc.measurements[name].raw = formula;
        doc.measurements[name].hasValue = formula.trim() !== '';
      }
    }
    resolveAll(doc);
  }

  if (defaultValue !== undefined) {
    const raw = String(defaultValue);
    for (const m of Object.values(doc.measurements)) {
      if (!m.hasValue) {
        m.raw = raw;
        m.hasValue = true;
      }
    }
    resolveAll(doc);
  }

  return doc;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Retrieves a measurement by name from the document.
 * Works for both individual and multisize documents.
 *
 * @param doc - The Seamly document.
 * @param name - The variable name of the measurement.
 * @returns The measurement object if found, otherwise undefined.
 *
 * @example
 * ```typescript
 * import { getMeasurement } from './document.js';
 * const measurement = getMeasurement(myDoc, 'bust_circ');
 * ```
 */
export function getMeasurement(
  doc: SeamlyDocument,
  name: string,
): SeamlyMeasurement | SeamlyMultisizeMeasurement | undefined {
  return doc.type === 'multisize'
    ? doc.multisizeMeasurements[name]
    : doc.measurements[name];
}

/**
 * Sets the formula or value for a measurement in an individual document.
 * Triggers a full resolution of all measurements.
 *
 * @param doc - The Seamly document.
 * @param name - The name of the measurement to update.
 * @param formulaOrValue - The new formula string or numeric value.
 * @returns The updated document.
 *
 * @example
 * ```typescript
 * import { setMeasurementValue } from './document.js';
 * setMeasurementValue(myDoc, 'bust_circ', '90 + 2');
 * ```
 */
export function setMeasurementValue(
  doc: SeamlyDocument,
  name: string,
  formulaOrValue: string | number,
): SeamlyDocument {
  assertIndividual(doc, 'setMeasurementValue');
  const measurement = doc.measurements[name];
  if (!measurement) throw new Error(`Measurement not found: ${name}`);
  measurement.raw = String(formulaOrValue);
  measurement.hasValue = measurement.raw.trim() !== '';
  resolveAll(doc);
  return doc;
}

/**
 * Updates the metadata (full name and description) of a measurement.
 *
 * @param doc - The Seamly document.
 * @param name - The name of the measurement to update.
 * @param patch - An object containing the new metadata values.
 * @returns The updated document.
 *
 * @example
 * ```typescript
 * import { setMeasurementMeta } from './document.js';
 * setMeasurementMeta(myDoc, 'bust_circ', { description: 'Updated notes' });
 * ```
 */
export function setMeasurementMeta(
  doc: SeamlyDocument,
  name: string,
  patch: MeasurementMetaPatch,
): SeamlyDocument {
  const measurement = getMeasurement(doc, name);
  if (!measurement) throw new Error(`Measurement not found: ${name}`);
  if (patch.fullName !== undefined) measurement.fullName = patch.fullName;
  if (patch.description !== undefined) measurement.desc = patch.description;
  return doc;
}

/**
 * Adds a new measurement to an individual document.
 *
 * @param doc - The Seamly document.
 * @param name - The name for the new measurement.
 * @param formula - The initial formula or value.
 * @returns The updated document.
 *
 * @example
 * ```typescript
 * import { addMeasurement } from './document.js';
 * addMeasurement(myDoc, '@my_custom', '10');
 * ```
 */
export function addMeasurement(
  doc: SeamlyDocument,
  name: string,
  formula = '',
): SeamlyDocument {
  assertIndividual(doc, 'addMeasurement');
  if (doc.measurements[name])
    throw new Error(`Measurement already exists: ${name}`);
  const seamly = lookupSeamlyMeasurement(name);
  doc.measurements[name] = {
    name,
    id: seamly?.id ?? (/^[A-Z]\d+$/.test(name) ? name : ''),
    raw: formula,
    fullName: seamly?.fullName ?? '',
    desc: '',
    resolved: null,
    hasValue: formula.trim() !== '',
    dependencies: [],
    error: null,
  };
  doc.measurementOrder.push(name);
  resolveAll(doc);
  return doc;
}

/**
 * Adds a new measurement after a specific existing measurement.
 *
 * @param doc - The Seamly document.
 * @param afterName - The name of the measurement to insert after.
 * @param name - The name for the new measurement.
 * @param formula - The initial formula or value.
 * @returns The updated document.
 *
 * @example
 * ```typescript
 * import { addMeasurementAfter } from './document.js';
 * addMeasurementAfter(myDoc, 'bust_circ', '@bust_ease', '2');
 * ```
 */
export function addMeasurementAfter(
  doc: SeamlyDocument,
  afterName: string,
  name: string,
  formula = '',
): SeamlyDocument {
  assertIndividual(doc, 'addMeasurementAfter');
  if (!doc.measurements[afterName])
    throw new Error(`Measurement not found: ${afterName}`);
  addMeasurement(doc, name, formula);
  moveMeasurement(doc, name, doc.measurementOrder.indexOf(afterName) + 1);
  return doc;
}

/**
 * Removes a measurement from the document.
 *
 * @param doc - The Seamly document.
 * @param name - The name of the measurement to remove.
 * @returns The updated document.
 *
 * @example
 * ```typescript
 * import { removeMeasurement } from './document.js';
 * removeMeasurement(myDoc, '@unneeded');
 * ```
 */
export function removeMeasurement(
  doc: SeamlyDocument,
  name: string,
): SeamlyDocument {
  if (doc.type === 'multisize') {
    if (!doc.multisizeMeasurements[name])
      throw new Error(`Measurement not found: ${name}`);
    delete doc.multisizeMeasurements[name];
    doc.multisizeMeasurementOrder = doc.multisizeMeasurementOrder.filter(
      item => item !== name,
    );
    return doc;
  }

  if (!doc.measurements[name])
    throw new Error(`Measurement not found: ${name}`);
  delete doc.measurements[name];
  doc.measurementOrder = doc.measurementOrder.filter(item => item !== name);
  resolveAll(doc);
  return doc;
}

/**
 * Moves a measurement to a new position in the list.
 *
 * @param doc - The Seamly document.
 * @param name - The name of the measurement to move.
 * @param target - The destination: a specific index or a direction ('top', 'up', 'down', 'bottom').
 * @returns The updated document.
 *
 * @example
 * ```typescript
 * import { moveMeasurement } from './document.js';
 * moveMeasurement(myDoc, 'bust_circ', 'top');
 * ```
 */
export function moveMeasurement(
  doc: SeamlyDocument,
  name: string,
  target: MeasurementMoveDirection | number,
): SeamlyDocument {
  const order = getOrder(doc);
  const index = order.indexOf(name);
  if (index === -1) throw new Error(`Measurement not found: ${name}`);

  const targetIndex =
    typeof target === 'number'
      ? target
      : target === 'top'
        ? 0
        : target === 'bottom'
          ? order.length - 1
          : target === 'up'
            ? index - 1
            : index + 1;

  moveMeasurements(doc, [name], targetIndex);
  return doc;
}

/**
 * Moves multiple measurements to a new position.
 *
 * @param doc - The Seamly document.
 * @param names - The names of the measurements to move.
 * @param targetIndex - The index where the measurements should be inserted.
 * @returns The updated document.
 *
 * @example
 * ```typescript
 * import { moveMeasurements } from './document.js';
 * moveMeasurements(myDoc, ['bust_circ', 'waist_circ'], 0);
 * ```
 */
export function moveMeasurements(
  doc: SeamlyDocument,
  names: string[],
  targetIndex: number,
): SeamlyDocument {
  const order = getOrder(doc);
  const uniqueNames = [...new Set(names)];
  for (const name of uniqueNames) {
    if (!order.includes(name))
      throw new Error(`Measurement not found: ${name}`);
  }

  const selected = order.filter(name => uniqueNames.includes(name));
  const remaining = order.filter(name => !uniqueNames.includes(name));
  const index = clamp(targetIndex, 0, remaining.length);
  const nextOrder = [
    ...remaining.slice(0, index),
    ...selected,
    ...remaining.slice(index),
  ];

  setOrder(doc, nextOrder);
  return doc;
}

/**
 * Renames a measurement and updates all formulas that reference it.
 *
 * @param doc - The Seamly document.
 * @param oldName - The current name of the measurement.
 * @param newName - The new name.
 * @returns The updated document.
 *
 * @example
 * ```typescript
 * import { renameMeasurement } from './document.js';
 * renameMeasurement(myDoc, '@old_name', '@new_name');
 * ```
 */
export function renameMeasurement(
  doc: SeamlyDocument,
  oldName: string,
  newName: string,
): SeamlyDocument {
  assertIndividual(doc, 'renameMeasurement');
  const measurement = doc.measurements[oldName];
  if (!measurement) throw new Error(`Measurement not found: ${oldName}`);
  if (doc.measurements[newName])
    throw new Error(`Measurement already exists: ${newName}`);

  const seamly = lookupSeamlyMeasurement(newName);
  delete doc.measurements[oldName];
  measurement.name = newName;
  measurement.id = seamly?.id ?? (/^[A-Z]\d+$/.test(newName) ? newName : '');
  measurement.fullName = seamly?.fullName ?? measurement.fullName;
  doc.measurements[newName] = measurement;
  doc.measurementOrder = doc.measurementOrder.map(name =>
    name === oldName ? newName : name,
  );

  for (const item of Object.values(doc.measurements)) {
    item.raw = replaceMeasurementReference(item.raw, oldName, newName);
  }

  resolveAll(doc);
  return doc;
}

/**
 * Creates a deep copy of the Seamly document.
 *
 * @param doc - The document to clone.
 * @returns A new Seamly document instance.
 *
 * @example
 * ```typescript
 * import { cloneDocument } from './document.js';
 * const copy = cloneDocument(myDoc);
 * ```
 */
export function cloneDocument(doc: SeamlyDocument): SeamlyDocument {
  return {
    ...doc,
    personal: {...doc.personal},
    measurements: Object.fromEntries(
      Object.entries(doc.measurements).map(([name, measurement]) => [
        name,
        {
          ...measurement,
          dependencies: [...measurement.dependencies],
        },
      ]),
    ),
    measurementOrder: [...doc.measurementOrder],
    multisize: doc.multisize ? {...doc.multisize} : null,
    multisizeMeasurements: Object.fromEntries(
      Object.entries(doc.multisizeMeasurements).map(([name, measurement]) => [
        name,
        {...measurement},
      ]),
    ),
    multisizeMeasurementOrder: [...doc.multisizeMeasurementOrder],
  };
}

/**
 * Applies multiple updates to a document using a patch object.
 * Creates a clone of the document before applying changes.
 *
 * @param doc - The document to update.
 * @param patch - The updates to apply.
 * @returns A new Seamly document with the updates applied.
 *
 * @example
 * ```typescript
 * import { updateDocument } from './document.js';
 * const updated = updateDocument(myDoc, { notes: 'New notes' });
 * ```
 */
export function updateDocument(
  doc: SeamlyDocument,
  patch: DocumentPatch,
): SeamlyDocument {
  const next = cloneDocument(doc);
  if (patch.version !== undefined) next.version = patch.version;
  if (patch.readOnly !== undefined) next.readOnly = patch.readOnly;
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.unit !== undefined) next.unit = patch.unit;
  if (patch.pmSys !== undefined) next.pmSys = patch.pmSys;
  if (patch.personal) next.personal = {...next.personal, ...patch.personal};

  if (patch.measurements) {
    for (const [name, measurementPatch] of Object.entries(patch.measurements)) {
      if (!next.measurements[name])
        throw new Error(`Measurement not found: ${name}`);
      if (measurementPatch.value !== undefined) {
        next.measurements[name].raw = String(measurementPatch.value);
        next.measurements[name].hasValue =
          next.measurements[name].raw.trim() !== '';
      }
      if (measurementPatch.fullName !== undefined)
        next.measurements[name].fullName = measurementPatch.fullName;
      if (measurementPatch.description !== undefined)
        next.measurements[name].desc = measurementPatch.description;
    }
  }

  resolveAll(next);
  return next;
}

/**
 * Resolves a potential measurement name conflict by appending a suffix if needed.
 *
 * @param doc - The Seamly document.
 * @param requestedName - The name that is desired.
 * @returns An object containing the resolved name and whether it was changed.
 *
 * @example
 * ```typescript
 * import { resolveMeasurementNameConflict } from './document.js';
 * const res = resolveMeasurementNameConflict(myDoc, 'bust_circ');
 * ```
 */
export function resolveMeasurementNameConflict(
  doc: SeamlyDocument,
  requestedName: string,
): NameConflictResolution {
  const exists =
    doc.type === 'multisize'
      ? requestedName in doc.multisizeMeasurements
      : requestedName in doc.measurements;
  if (!exists)
    return {requested: requestedName, resolved: requestedName, changed: false};

  let index = 1;
  let candidate = `${requestedName}_${index}`;
  const items =
    doc.type === 'multisize' ? doc.multisizeMeasurements : doc.measurements;
  while (candidate in items) {
    index += 1;
    candidate = `${requestedName}_${index}`;
  }

  return {requested: requestedName, resolved: candidate, changed: true};
}

/**
 * Lists all measurements in the document in their defined order.
 *
 * @param doc - The Seamly document.
 * @returns An array of measurement objects.
 *
 * @example
 * ```typescript
 * import { listAll } from './document.js';
 * const all = listAll(myDoc);
 * ```
 */
export function listAll(
  doc: SeamlyDocument,
): Array<SeamlyMeasurement | SeamlyMultisizeMeasurement> {
  return doc.type === 'multisize'
    ? ordered(doc.multisizeMeasurementOrder, doc.multisizeMeasurements)
    : ordered(doc.measurementOrder, doc.measurements);
}

/**
 * Lists all standard (known) measurements in the document.
 *
 * @param doc - The Seamly document.
 * @returns An array of standard measurement objects.
 *
 * @example
 * ```typescript
 * import { listKnown } from './document.js';
 * const known = listKnown(myDoc);
 * ```
 */
export function listKnown(
  doc: SeamlyDocument,
): Array<SeamlyMeasurement | SeamlyMultisizeMeasurement> {
  return listAll(doc).filter(measurement =>
    isKnownMeasurementName(measurement.name),
  );
}

/**
 * Lists all custom (user-defined) measurements in the document.
 *
 * @param doc - The Seamly document.
 * @returns An array of custom measurement objects.
 *
 * @example
 * ```typescript
 * import { listCustom } from './document.js';
 * const custom = listCustom(myDoc);
 * ```
 */
export function listCustom(
  doc: SeamlyDocument,
): Array<SeamlyMeasurement | SeamlyMultisizeMeasurement> {
  return listAll(doc).filter(
    measurement => !isKnownMeasurementName(measurement.name),
  );
}

/**
 * Generates a flat list of measurement rows suitable for display in a table.
 * Includes calculated values, dependency information, and error status.
 *
 * @param doc - The Seamly document.
 * @returns An array of measurement rows.
 *
 * @example
 * ```typescript
 * import { getMeasurementRows } from './document.js';
 * const rows = getMeasurementRows(myDoc);
 * ```
 */
export function getMeasurementRows(doc: SeamlyDocument): MeasurementRow[] {
  if (doc.type === 'multisize') {
    return ordered(
      doc.multisizeMeasurementOrder,
      doc.multisizeMeasurements,
    ).map((measurement, index) => ({
      index,
      id: measurement.id,
      name: measurement.name,
      label: measurement.fullName || measurement.name,
      description: measurement.desc,
      raw: `base=${formatMaybeNumber(measurement.base)}; size_increase=${formatMaybeNumber(measurement.sizeIncrement)}; height_increase=${formatMaybeNumber(measurement.heightIncrement)}`,
      value: measurement.base,
      unit: doc.unit,
      hasValue: measurement.hasValue,
      isResolved: measurement.hasValue && measurement.base !== null,
      isKnown: isKnownMeasurementName(measurement.name),
      isCustom: isCustomMeasurementName(measurement.name),
      dependencies: [],
      dependents: [],
      error: null,
    }));
  }

  const dependentsByName = new Map<string, string[]>();
  for (const measurement of ordered(doc.measurementOrder, doc.measurements)) {
    for (const dependency of measurement.dependencies) {
      const dependents = dependentsByName.get(dependency) ?? [];
      dependents.push(measurement.name);
      dependentsByName.set(dependency, dependents);
    }
  }

  return ordered(doc.measurementOrder, doc.measurements).map(
    (measurement, index) => ({
      index,
      id: measurement.id,
      name: measurement.name,
      label: measurement.fullName || measurement.name,
      description: measurement.desc,
      raw: measurement.raw,
      value: measurement.resolved,
      unit: doc.unit,
      hasValue: measurement.hasValue,
      isResolved: measurement.hasValue && measurement.resolved !== null,
      isKnown: isKnownMeasurementName(measurement.name),
      isCustom: isCustomMeasurementName(measurement.name),
      dependencies: [...measurement.dependencies],
      dependents: dependentsByName.get(measurement.name) ?? [],
      error: measurement.error,
    }),
  );
}

/**
 * Validates that all non-custom measurements in the document use standard Seamly names.
 *
 * @param doc - The Seamly document.
 * @returns An array of validation issues.
 *
 * @example
 * ```typescript
 * import { validateKnownNames } from './document.js';
 * const issues = validateKnownNames(myDoc);
 * ```
 */
export function validateKnownNames(doc: SeamlyDocument): ValidationIssue[] {
  return listAll(doc)
    .filter(
      measurement =>
        !isCustomMeasurementName(measurement.name) &&
        !isKnownMeasurementName(measurement.name),
    )
    .map(measurement => ({
      severity: 'error',
      code: 'unknown-measurement-name',
      message: `Unknown standard measurement name: ${measurement.name}`,
      measurement: measurement.name,
    }));
}

/**
 * Performs a comprehensive validation of the document.
 * Checks for missing metadata, unsupported units, unknown names, circular dependencies, and formula errors.
 *
 * @param doc - The Seamly document.
 * @returns An array of validation issues (errors and warnings).
 *
 * @example
 * ```typescript
 * import { validateDocument } from './document.js';
 * const issues = validateDocument(myDoc);
 * ```
 */
export function validateDocument(doc: SeamlyDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!doc.version)
    issues.push({
      severity: 'warning',
      code: 'missing-version',
      message: 'Missing file format version.',
    });
  if (!['cm', 'mm', 'inch'].includes(doc.unit)) {
    issues.push({
      severity: 'error',
      code: 'unsupported-unit',
      message: `Unsupported unit: ${doc.unit || '(missing)'}`,
    });
  }

  issues.push(...validateKnownNames(doc));

  if (doc.type === 'individual') {
    for (const cycle of detectCycles(doc)) {
      issues.push({
        severity: 'error',
        code: 'circular-dependency',
        message: `Circular dependency: ${cycle.join(' -> ')}`,
        measurement: cycle[0],
      });
    }
    for (const measurement of listAll(doc) as SeamlyMeasurement[]) {
      if (measurement.hasValue && measurement.error) {
        issues.push({
          severity: 'error',
          code: 'formula-error',
          message: measurement.error,
          measurement: measurement.name,
        });
      }
    }
  }

  return issues;
}

/**
 * Finds all measurements that depend on the given measurement.
 *
 * @param doc - The Seamly document.
 * @param name - The name of the measurement.
 * @returns An array of measurement names that reference the given measurement.
 *
 * @example
 * ```typescript
 * import { findDependents } from './document.js';
 * const dependents = findDependents(myDoc, 'bust_circ');
 * ```
 */
export function findDependents(doc: SeamlyDocument, name: string): string[] {
  const graph = buildDependencyGraph(doc);
  return Object.entries(graph)
    .filter(([, dependencies]) => dependencies.includes(name))
    .map(([dependent]) => dependent);
}

/**
 * Detects any circular dependencies between measurements.
 *
 * @param doc - The Seamly document.
 * @returns An array of cycles, where each cycle is an array of measurement names.
 *
 * @example
 * ```typescript
 * import { detectCycles } from './document.js';
 * const cycles = detectCycles(myDoc);
 * ```
 */
export function detectCycles(doc: SeamlyDocument): string[][] {
  if (doc.type !== 'individual') return [];
  const graph = buildDependencyGraph(doc);
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(name: string, stack: string[]): void {
    if (visiting.has(name)) {
      const start = stack.indexOf(name);
      cycles.push([...stack.slice(start), name]);
      return;
    }
    if (visited.has(name)) return;

    visiting.add(name);
    for (const dep of graph[name] ?? []) visit(dep, [...stack, name]);
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of doc.measurementOrder) visit(name, []);
  return dedupeCycles(cycles);
}

/**
 * Reorders the measurements in the document using a topological sort based on their dependencies.
 * Standard Seamly measurements are prioritized to appear first, followed by custom variables.
 * Within each category, alphabetical order (for standard IDs) or original order is used as a tie-breaker.
 *
 * @param doc - The Seamly document.
 * @returns The updated document with reordered measurementOrder.
 *
 * @example
 * ```typescript
 * import { reorderByDependencies } from './document.js';
 * reorderByDependencies(myDoc);
 * ```
 */
export function reorderByDependencies(doc: SeamlyDocument): SeamlyDocument {
  if (doc.type !== 'individual') return doc;

  const graph = buildDependencyGraph(doc);
  const names = Object.keys(doc.measurements);

  // dependency -> dependents
  const dependents = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const name of names) {
    inDegree.set(name, 0);
  }

  for (const [name, deps] of Object.entries(graph)) {
    inDegree.set(name, deps.length);
    for (const dep of deps) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(name);
    }
  }

  const ready = names.filter(name => (inDegree.get(name) ?? 0) === 0);
  const result: string[] = [];

  // Pre-calculate sort weights for efficiency and consistent priority
  const weights = new Map<string, string>();
  for (const name of names) {
    if (isCustomMeasurementName(name)) {
      weights.set(name, `1_${name}`);
    } else {
      const seamly = lookupSeamlyMeasurement(name);
      // Use "0_" prefix for standard, sorted by ID (A01, B01, etc.)
      weights.set(name, `0_${seamly?.id ?? name}`);
    }
  }

  while (ready.length > 0) {
    // Sort ready nodes by weight (Standard then Custom)
    ready.sort((a, b) => {
      const wa = weights.get(a)!;
      const wb = weights.get(b)!;
      if (wa < wb) return -1;
      if (wa > wb) return 1;
      return 0;
    });

    const n = ready.shift()!;
    result.push(n);

    for (const m of dependents.get(n) ?? []) {
      inDegree.set(m, (inDegree.get(m) ?? 0) - 1);
      if (inDegree.get(m) === 0) {
        ready.push(m);
      }
    }
  }

  // Handle cycles or missing names by appending remaining items
  if (result.length < names.length) {
    const remaining = names.filter(name => !result.includes(name));
    result.push(...remaining);
  }

  doc.measurementOrder = result;
  return doc;
}

/**
 * Resolves all individual measurements in a document by evaluating their formulas.
 * Updates the `resolved`, `dependencies`, and `error` properties of each measurement.
 *
 * @param doc - The document to resolve.
 * @returns The document with resolved measurements.
 *
 * @example
 * ```typescript
 * import { resolveAll } from './document.js';
 * const resolvedDoc = resolveAll(myDoc);
 * ```
 */
export function resolveAll(doc: SeamlyDocument): SeamlyDocument {
  if (doc.type === 'individual') {
    doc.measurements = resolveMeasurements(doc.measurements);
  }
  return doc;
}

function assertIndividual(doc: SeamlyDocument, operation: string): void {
  if (doc.type !== 'individual')
    throw new Error(
      `${operation} is only supported for individual measurements.`,
    );
}

function getOrder(doc: SeamlyDocument): string[] {
  return doc.type === 'multisize'
    ? doc.multisizeMeasurementOrder
    : doc.measurementOrder;
}

function setOrder(doc: SeamlyDocument, order: string[]): void {
  if (doc.type === 'multisize') doc.multisizeMeasurementOrder = order;
  else doc.measurementOrder = order;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatMaybeNumber(value: number | null): string {
  return value === null ? '' : String(value);
}

function isKnownMeasurementName(name: string): boolean {
  return name in SEAMLY_BY_VAR || name in SEAMLY_BY_ID;
}

function isCustomMeasurementName(name: string): boolean {
  return name.startsWith('@');
}

function ordered<T>(order: string[], items: Record<string, T>): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const name of order) {
    if (name in items && !seen.has(name)) {
      result.push(items[name]);
      seen.add(name);
    }
  }
  for (const [name, item] of Object.entries(items)) {
    if (!seen.has(name)) result.push(item);
  }
  return result;
}

function replaceMeasurementReference(
  expr: string,
  oldName: string,
  newName: string,
): string {
  if (!expr.includes(oldName)) return expr;
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return expr.replace(
    new RegExp(`(?<![\\w@])${escaped}(?![\\w])`, 'g'),
    newName,
  );
}

function dedupeCycles(cycles: string[][]): string[][] {
  const seen = new Set<string>();
  return cycles.filter(cycle => {
    const key = cycle.join('\0');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
