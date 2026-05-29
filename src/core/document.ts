import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { lookupSeamlyMeasurement, SEAMLY_BY_ID, SEAMLY_BY_VAR } from './catalog.js';
import { buildDependencyGraph, resolveMeasurements } from './expressions.js';
import { detectMeasurementFile, modernExtensionForType, parseSmis, serializeSmis } from './smis.js';
import type {
  LoadedMeasurementFile,
  MeasurementFileType,
  MeasurementFileWarning,
  MeasurementMetaPatch,
  SavedMeasurementFile,
  SaveMeasurementFileOptions,
  SeamlyDocument,
  SeamlyMeasurement,
  SeamlyMultisizeMeasurement,
  ValidationIssue,
} from './types.js';

export function loadMeasurementFile(input: string, filename?: string): LoadedMeasurementFile {
  const xml = looksLikeXml(input) || !existsSync(input) ? input : readFileSync(input, 'utf8');
  const effectiveFilename = filename ?? (looksLikeXml(input) ? undefined : input);
  const warnings = detectFileWarnings(xml, effectiveFilename);
  const root = detectMeasurementRoot(xml);
  const doc = parseSmis(xml, {
    filename: effectiveFilename,
    type: root?.type,
  });

  if (root) {
    doc.type = root.type;
    doc.format = root.format;
  }

  return { document: doc, warnings };
}

export function saveMeasurementFile(
  doc: SeamlyDocument,
  options: SaveMeasurementFileOptions = {},
): SavedMeasurementFile {
  const xml = serializeSmis(doc, options);
  const warnings = options.path && !options.path.toLowerCase().endsWith(modernExtensionForType(doc.type))
    ? [{
        code: 'save-extension-mismatch',
        message: `Modern ${doc.type} measurements should be saved as *${modernExtensionForType(doc.type)}.`,
      }]
    : [];

  if (options.path) writeFileSync(options.path, xml, 'utf8');
  return { xml, warnings };
}

export function getMeasurement(
  doc: SeamlyDocument,
  name: string,
): SeamlyMeasurement | SeamlyMultisizeMeasurement | undefined {
  return doc.type === 'multisize' ? doc.multisizeMeasurements[name] : doc.measurements[name];
}

export function setMeasurementValue(doc: SeamlyDocument, name: string, formulaOrValue: string | number): SeamlyDocument {
  assertIndividual(doc, 'setMeasurementValue');
  const measurement = doc.measurements[name];
  if (!measurement) throw new Error(`Measurement not found: ${name}`);
  measurement.raw = String(formulaOrValue);
  measurement.hasValue = measurement.raw.trim() !== '';
  resolveAll(doc);
  return doc;
}

export function setMeasurementMeta(doc: SeamlyDocument, name: string, patch: MeasurementMetaPatch): SeamlyDocument {
  const measurement = getMeasurement(doc, name);
  if (!measurement) throw new Error(`Measurement not found: ${name}`);
  if (patch.fullName !== undefined) measurement.fullName = patch.fullName;
  if (patch.description !== undefined) measurement.desc = patch.description;
  return doc;
}

export function addMeasurement(doc: SeamlyDocument, name: string, formula = ''): SeamlyDocument {
  assertIndividual(doc, 'addMeasurement');
  if (doc.measurements[name]) throw new Error(`Measurement already exists: ${name}`);
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

export function removeMeasurement(doc: SeamlyDocument, name: string): SeamlyDocument {
  if (doc.type === 'multisize') {
    if (!doc.multisizeMeasurements[name]) throw new Error(`Measurement not found: ${name}`);
    delete doc.multisizeMeasurements[name];
    doc.multisizeMeasurementOrder = doc.multisizeMeasurementOrder.filter((item) => item !== name);
    return doc;
  }

  if (!doc.measurements[name]) throw new Error(`Measurement not found: ${name}`);
  delete doc.measurements[name];
  doc.measurementOrder = doc.measurementOrder.filter((item) => item !== name);
  resolveAll(doc);
  return doc;
}

export function renameMeasurement(doc: SeamlyDocument, oldName: string, newName: string): SeamlyDocument {
  assertIndividual(doc, 'renameMeasurement');
  const measurement = doc.measurements[oldName];
  if (!measurement) throw new Error(`Measurement not found: ${oldName}`);
  if (doc.measurements[newName]) throw new Error(`Measurement already exists: ${newName}`);

  const seamly = lookupSeamlyMeasurement(newName);
  delete doc.measurements[oldName];
  measurement.name = newName;
  measurement.id = seamly?.id ?? (/^[A-Z]\d+$/.test(newName) ? newName : '');
  measurement.fullName = seamly?.fullName ?? measurement.fullName;
  doc.measurements[newName] = measurement;
  doc.measurementOrder = doc.measurementOrder.map((name) => (name === oldName ? newName : name));

  for (const item of Object.values(doc.measurements)) {
    item.raw = replaceMeasurementReference(item.raw, oldName, newName);
  }

  resolveAll(doc);
  return doc;
}

export function listAll(doc: SeamlyDocument): Array<SeamlyMeasurement | SeamlyMultisizeMeasurement> {
  return doc.type === 'multisize'
    ? ordered(doc.multisizeMeasurementOrder, doc.multisizeMeasurements)
    : ordered(doc.measurementOrder, doc.measurements);
}

export function listKnown(doc: SeamlyDocument): Array<SeamlyMeasurement | SeamlyMultisizeMeasurement> {
  return listAll(doc).filter((measurement) => isKnownMeasurementName(measurement.name));
}

export function listCustom(doc: SeamlyDocument): Array<SeamlyMeasurement | SeamlyMultisizeMeasurement> {
  return listAll(doc).filter((measurement) => !isKnownMeasurementName(measurement.name));
}

export function validateKnownNames(doc: SeamlyDocument): ValidationIssue[] {
  return listAll(doc)
    .filter((measurement) => !isCustomMeasurementName(measurement.name) && !isKnownMeasurementName(measurement.name))
    .map((measurement) => ({
      severity: 'error',
      code: 'unknown-measurement-name',
      message: `Unknown standard measurement name: ${measurement.name}`,
      measurement: measurement.name,
    }));
}

export function validateDocument(doc: SeamlyDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!doc.version) issues.push({ severity: 'warning', code: 'missing-version', message: 'Missing file format version.' });
  if (!['cm', 'mm', 'inch'].includes(doc.unit)) {
    issues.push({ severity: 'error', code: 'unsupported-unit', message: `Unsupported unit: ${doc.unit || '(missing)'}` });
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

export function findDependents(doc: SeamlyDocument, name: string): string[] {
  const graph = buildDependencyGraph(doc);
  return Object.entries(graph)
    .filter(([, dependencies]) => dependencies.includes(name))
    .map(([dependent]) => dependent);
}

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

export function resolveAll(doc: SeamlyDocument): SeamlyDocument {
  if (doc.type === 'individual') {
    doc.measurements = resolveMeasurements(doc.measurements);
  }
  return doc;
}

function detectFileWarnings(xml: string, filename?: string): MeasurementFileWarning[] {
  if (!filename) return [];
  const root = detectMeasurementRoot(xml);
  const warnings: MeasurementFileWarning[] = [];
  if (!root) return warnings;

  let fileInfo;
  try {
    fileInfo = detectMeasurementFile(filename);
  } catch {
    return warnings;
  }

  if (fileInfo.type !== root.type) {
    warnings.push({
      code: 'extension-root-type-mismatch',
      message: `Extension ${fileInfo.extension} implies ${fileInfo.type}, but XML root <${root.name}> is ${root.type}.`,
    });
  }
  if (fileInfo.format !== root.format) {
    warnings.push({
      code: 'extension-root-format-mismatch',
      message: `Extension ${fileInfo.extension} implies ${fileInfo.format}, but XML root <${root.name}> is ${root.format}.`,
    });
  }

  return warnings;
}

function detectMeasurementRoot(xml: string): { name: 'smis' | 'smms' | 'vit' | 'vst'; type: MeasurementFileType; format: 'modern' | 'legacy' } | null {
  const match = xml.match(/<\s*(smis|smms|vit|vst)(?:\s|>)/i);
  if (!match) return null;
  const name = match[1].toLowerCase() as 'smis' | 'smms' | 'vit' | 'vst';
  return {
    name,
    type: name === 'smms' || name === 'vst' ? 'multisize' : 'individual',
    format: name === 'vit' || name === 'vst' ? 'legacy' : 'modern',
  };
}

function assertIndividual(doc: SeamlyDocument, operation: string): void {
  if (doc.type !== 'individual') throw new Error(`${operation} is only supported for individual measurements.`);
}

function looksLikeXml(input: string): boolean {
  return input.trimStart().startsWith('<');
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

function replaceMeasurementReference(expr: string, oldName: string, newName: string): string {
  if (!expr.includes(oldName)) return expr;
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return expr.replace(new RegExp(`(?<![\\w@])${escaped}(?![\\w])`, 'g'), newName);
}

function dedupeCycles(cycles: string[][]): string[][] {
  const seen = new Set<string>();
  return cycles.filter((cycle) => {
    const key = cycle.join('\0');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
