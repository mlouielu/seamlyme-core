import {XMLBuilder, XMLParser} from 'fast-xml-parser';
import {
  lookupSeamlyMeasurement,
  SEAMLY_BY_VAR,
  SEAMLY_MEASUREMENT_CATALOG,
} from './catalog.js';
import {SEAMLYME_CORE_VERSION, SEAMLYME_FORMAT_VERSION} from './config.js';
import {resolveMeasurements} from './expressions.js';
import type {
  MeasurementFileInfo,
  MeasurementFileType,
  ParseSmisOptions,
  SeamlyDocument,
  SeamlyMeasurement,
  SeamlyMultisizeMeasurement,
  SeamlyPersonalInfo,
  SerializeSmisOptions,
} from './types.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (_name, jpath) =>
    typeof jpath === 'string' &&
    [
      'smis.body-measurements.m',
      'smms.body-measurements.m',
      'vit.body-measurements.m',
      'vst.body-measurements.m',
    ].includes(jpath),
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true,
});

/**
 * Parses SeamlyMe XML measurement data.
 * Supports .smis, .smms, .vit, and .vst formats.
 *
 * @param xmlText - The raw XML string to parse.
 * @param options - Parsing options.
 * @returns A structured SeamlyDocument.
 *
 * @example
 * ```typescript
 * import { parseSmis } from './smis.js';
 * const doc = parseSmis(xmlString);
 * ```
 */
export function parseSmis(
  xmlText: string,
  options: ParseSmisOptions = {},
): SeamlyDocument {
  let parsed: unknown;
  try {
    parsed = parser.parse(xmlText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid XML';
    throw new Error(`XML parse error: ${message}`);
  }

  const parsedRecord = asRecord(parsed);
  const rootName = detectRootName(parsedRecord);
  const root = rootName ? asRecord(parsedRecord[rootName]) : {};
  if (!rootName || !isRecord(root)) {
    throw new Error(
      'Invalid measurement file: missing <smis>, <smms>, <vit>, or <vst> root',
    );
  }

  const fileInfo = options.filename
    ? detectMeasurementFile(options.filename)
    : null;
  const type =
    options.type ?? fileInfo?.type ?? inferMeasurementType(rootName, root);
  const body = asRecord(root['body-measurements']);
  const rawMeasurements = toArray(body.m);
  const measurements: Record<string, SeamlyMeasurement> = {};
  const measurementOrder: string[] = [];
  const multisizeMeasurements: Record<string, SeamlyMultisizeMeasurement> = {};
  const multisizeMeasurementOrder: string[] = [];

  for (const rawMeasurement of rawMeasurements) {
    if (!isRecord(rawMeasurement)) continue;
    const name = readAttr(rawMeasurement, 'name');
    if (!name) continue;

    const fullName = readAttr(rawMeasurement, 'full_name');
    const desc = readAttr(rawMeasurement, 'description');
    const seamly = lookupSeamlyMeasurement(name);

    if (type === 'multisize') {
      if (!multisizeMeasurements[name]) multisizeMeasurementOrder.push(name);
      multisizeMeasurements[name] = {
        name,
        id: seamly?.id ?? (/^[A-Z]\d+$/.test(name) ? name : ''),
        base: readNumberAttr(rawMeasurement, 'base'),
        sizeIncrement:
          readNumberAttr(rawMeasurement, 'size_increase') ??
          readNumberAttr(rawMeasurement, 'size-increment'),
        heightIncrement:
          readNumberAttr(rawMeasurement, 'height_increase') ??
          readNumberAttr(rawMeasurement, 'height-increment'),
        fullName: fullName || seamly?.fullName || '',
        desc,
        hasValue: readAttr(rawMeasurement, 'base').trim() !== '',
      };
      continue;
    }

    const raw = readAttr(rawMeasurement, 'value');

    if (!measurements[name]) measurementOrder.push(name);
    measurements[name] = {
      name,
      id: seamly?.id ?? (/^[A-Z]\d+$/.test(name) ? name : ''),
      raw,
      fullName: fullName || seamly?.fullName || '',
      desc,
      resolved: null,
      hasValue: raw.trim() !== '',
      dependencies: [],
      error: null,
    };
  }

  if (type === 'individual' && (options.includeCatalog ?? true)) {
    for (const seamly of SEAMLY_MEASUREMENT_CATALOG) {
      if (measurements[seamly.name]) continue;
      measurementOrder.push(seamly.name);
      measurements[seamly.name] = {
        name: seamly.name,
        id: seamly.id,
        raw: '',
        fullName: seamly.fullName,
        desc: '',
        resolved: null,
        hasValue: false,
        dependencies: [],
        error: null,
      };
    }
  }

  return {
    type,
    format:
      fileInfo?.format ??
      (rootName === 'vit' || rootName === 'vst' ? 'legacy' : 'modern'),
    version: readText(root.version),
    readOnly: readText(root['read-only']) === 'true',
    notes: readText(root.notes),
    unit: readText(root.unit),
    pmSys:
      readText(root.pm_system) || readText(asRecord(root.personal).pm_system),
    personal: readPersonal(root.personal),
    measurements:
      type === 'individual' ? resolveMeasurements(measurements) : {},
    measurementOrder: type === 'individual' ? measurementOrder : [],
    multisize:
      type === 'multisize'
        ? {
            baseSize: readNumber(root.size),
            baseHeight: readNumber(root.height),
          }
        : null,
    multisizeMeasurements,
    multisizeMeasurementOrder:
      type === 'multisize' ? multisizeMeasurementOrder : [],
  };
}

/**
 * Serializes a SeamlyDocument into a SeamlyMe XML string.
 *
 * @param document - The document to serialize.
 * @param options - Serialization options.
 * @returns A formatted XML string.
 *
 * @example
 * ```typescript
 * import { serializeSmis } from './smis.js';
 * const xml = serializeSmis(myDoc);
 * ```
 */
export function serializeSmis(
  document: SeamlyDocument,
  options: SerializeSmisOptions = {},
): string {
  const bodyMeasurements =
    document.type === 'multisize'
      ? orderMultisizeMeasurements(document).map(measurement => {
          const attrs: Record<string, string> = {
            '@_name': measurement.name,
            '@_base': formatNumber(measurement.base),
            '@_size_increase': formatNumber(measurement.sizeIncrement),
            '@_height_increase': formatNumber(measurement.heightIncrement),
          };
          if (measurement.fullName) attrs['@_full_name'] = measurement.fullName;
          if (measurement.desc) attrs['@_description'] = measurement.desc;
          return attrs;
        })
      : serializeIndividualMeasurements(document, options);

  const rootTag = document.type === 'multisize' ? 'smms' : 'smis';
  const rootContent =
    document.type === 'multisize'
      ? {
          version: document.version || SEAMLYME_FORMAT_VERSION,
          unit: document.unit,
          'read-only': String(document.readOnly),
          notes: document.notes,
          size: formatNumber(document.multisize?.baseSize ?? null),
          height: formatNumber(document.multisize?.baseHeight ?? null),
          'body-measurements': {
            m: bodyMeasurements,
          },
        }
      : {
          version: document.version || SEAMLYME_FORMAT_VERSION,
          'read-only': String(document.readOnly),
          notes: document.notes,
          unit: document.unit,
          pm_system: document.pmSys,
          personal: document.personal,
          'body-measurements': {
            m: bodyMeasurements,
          },
        };

  return `<?xml version="1.0" encoding="UTF-8"?>\n<!--Measurements created with SeamlyMe-core ${SEAMLYME_CORE_VERSION} (https://github.com/mlouielu/seamlyme-core).-->\n${builder.build(
    {
      [rootTag]: rootContent,
    },
  )}\n`;
}

/**
 * Detects the file type and format based on a filename's extension.
 *
 * @param filename - The filename to analyze.
 * @returns Information about the measurement file.
 *
 * @example
 * ```typescript
 * import { detectMeasurementFile } from './smis.js';
 * const info = detectMeasurementFile('standard.vit');
 * ```
 */
export function detectMeasurementFile(filename: string): MeasurementFileInfo {
  const match = filename.toLowerCase().match(/(\.[^.]+)$/);
  const extension = match?.[1] ?? '';

  switch (extension) {
    case '.smis':
      return {
        extension,
        type: 'individual',
        format: 'modern',
        modernExtension: '.smis',
      };
    case '.vit':
      return {
        extension,
        type: 'individual',
        format: 'legacy',
        modernExtension: '.smis',
      };
    case '.smms':
      return {
        extension,
        type: 'multisize',
        format: 'modern',
        modernExtension: '.smms',
      };
    case '.vst':
      return {
        extension,
        type: 'multisize',
        format: 'legacy',
        modernExtension: '.smms',
      };
    default:
      throw new Error(
        `Unsupported measurement file extension: ${extension || '(none)'}`,
      );
  }
}

/**
 * Returns the recommended modern file extension for a given measurement file type.
 *
 * @param type - The type of measurements (individual or multisize).
 * @returns '.smis' for individual or '.smms' for multisize.
 *
 * @example
 * ```typescript
 * import { modernExtensionForType } from './smis.js';
 * const ext = modernExtensionForType('individual'); // '.smis'
 * ```
 */
export function modernExtensionForType(
  type: MeasurementFileType,
): '.smis' | '.smms' {
  return type === 'individual' ? '.smis' : '.smms';
}

/**
 * Calculates a specific measurement value for a given size and height using multisize increments.
 *
 * @param document - The multisize document containing base values and increments.
 * @param name - The name of the measurement to calculate.
 * @param size - The target size.
 * @param height - The target height.
 * @returns The calculated value, or null if the document is not multisize or measurement is missing.
 *
 * @example
 * ```typescript
 * import { calculateMultisizeValue } from './smis.js';
 * const val = calculateMultisizeValue(multisizeDoc, 'bust_circ', 40, 170);
 * ```
 */
export function calculateMultisizeValue(
  document: SeamlyDocument,
  name: string,
  size: number,
  height: number,
): number | null {
  if (document.type !== 'multisize' || !document.multisize) return null;
  const measurement = document.multisizeMeasurements[name];
  if (!measurement || measurement.base === null) return null;

  const sizeDelta = size - (document.multisize.baseSize ?? size);
  const heightDelta = height - (document.multisize.baseHeight ?? height);
  return (
    measurement.base +
    sizeDelta * (measurement.sizeIncrement ?? 0) +
    heightDelta * (measurement.heightIncrement ?? 0)
  );
}

function serializeIndividualMeasurements(
  document: SeamlyDocument,
  options: SerializeSmisOptions,
): Record<string, string>[] {
  const measurements = orderMeasurements(document)
    .filter(
      measurement =>
        options.includeMissingCatalogMeasurements || measurement.hasValue,
    )
    .map(measurement => {
      const attrs: Record<string, string> = {
        '@_name': measurement.name,
        '@_value': measurement.raw,
      };
      if (
        measurement.fullName &&
        measurement.fullName !== SEAMLY_BY_VAR[measurement.name]?.fullName
      ) {
        attrs['@_full_name'] = measurement.fullName;
      }
      if (measurement.desc) attrs['@_description'] = measurement.desc;
      return attrs;
    });
  return measurements;
}

function orderMeasurements(document: SeamlyDocument): SeamlyMeasurement[] {
  return orderNames(document.measurementOrder, document.measurements).map(
    name => document.measurements[name],
  );
}

function orderMultisizeMeasurements(
  document: SeamlyDocument,
): SeamlyMultisizeMeasurement[] {
  return orderNames(
    document.multisizeMeasurementOrder,
    document.multisizeMeasurements,
  ).map(name => document.multisizeMeasurements[name]);
}

function orderNames<T>(order: string[], items: Record<string, T>): string[] {
  const seen = new Set<string>();
  const ordered = order.filter(name => {
    if (!(name in items) || seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  for (const name of Object.keys(items)) {
    if (!seen.has(name)) ordered.push(name);
  }

  return ordered;
}

function readPersonal(value: unknown): SeamlyPersonalInfo {
  const personal = asRecord(value);
  return {
    'family-name': readText(personal['family-name']),
    'given-name': readText(personal['given-name']),
    'birth-date': readText(personal['birth-date']),
    gender: readText(personal.gender),
    email: readText(personal.email),
  };
}

function readAttr(value: Record<string, unknown>, key: string): string {
  return decodeXmlAttribute(readText(value[`@_${key}`]));
}

function readNumberAttr(
  value: Record<string, unknown>,
  key: string,
): number | null {
  return readNumber(readAttr(value, key));
}

function readNumber(value: unknown): number | null {
  const raw = readText(value);
  if (raw === '') return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: number | null): string {
  return value === null ? '' : String(value);
}

function readText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function detectRootName(
  parsed: Record<string, unknown>,
): 'smis' | 'smms' | 'vit' | 'vst' | null {
  for (const name of ['smis', 'smms', 'vit', 'vst'] as const) {
    if (isRecord(parsed[name])) return name;
  }
  return null;
}

function inferMeasurementType(
  rootName: string,
  root: Record<string, unknown>,
): MeasurementFileType {
  if (rootName === 'smms' || rootName === 'vst') return 'multisize';
  if ('size' in root || 'height' in root) return 'multisize';
  const first = toArray(asRecord(root['body-measurements']).m).find(isRecord);
  return first &&
    ('@_base' in first ||
      '@_size_increase' in first ||
      '@_height_increase' in first)
    ? 'multisize'
    : 'individual';
}

function decodeXmlAttribute(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
