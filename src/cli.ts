#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  calculateMultisizeValue,
  detectMeasurementFile,
  parseSmis,
  validateResolvedMeasurements,
  type SeamlyDocument,
} from './index.js';

interface CliOptions {
  command: string | null;
  file: string | null;
  json: boolean;
  list: boolean;
  errorsOnly: boolean;
  includeCatalog: boolean;
  size: number | null;
  height: number | null;
}

main();

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (!options.command || options.command === 'help' || options.command === '--help' || options.command === '-h') {
      printHelp();
      process.exit(options.command ? 0 : 1);
    }

    if (options.command !== 'validate') {
      throw new Error(`Unknown command: ${options.command}`);
    }
    if (!options.file) {
      throw new Error('Missing measurement file path.');
    }

    const xml = readFileSync(options.file, 'utf8');
    const doc = parseSmis(xml, {
      filename: options.file,
      includeCatalog: options.includeCatalog,
    });
    const report = buildReport(doc, options.file, options);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report, options);
    }

    process.exit(report.ok ? 0 : 2);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    command: args[0] ?? null,
    file: null,
    json: false,
    list: false,
    errorsOnly: false,
    includeCatalog: true,
    size: null,
    height: null,
  };

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];

    switch (arg) {
      case '--json':
        options.json = true;
        break;
      case '--list':
        options.list = true;
        break;
      case '--errors-only':
        options.errorsOnly = true;
        break;
      case '--no-catalog':
        options.includeCatalog = false;
        break;
      case '--size':
        options.size = readNumberFlag(args, ++i, '--size');
        break;
      case '--height':
        options.height = readNumberFlag(args, ++i, '--height');
        break;
      default:
        if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
        if (options.file) throw new Error(`Unexpected extra argument: ${arg}`);
        options.file = arg;
    }
  }

  return options;
}

function readNumberFlag(args: string[], index: number, flag: string): number {
  const raw = args[index];
  if (raw === undefined) throw new Error(`Missing value for ${flag}`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid number for ${flag}: ${raw}`);
  return value;
}

function buildReport(doc: SeamlyDocument, file: string, options: CliOptions) {
  const fileInfo = detectMeasurementFile(file);
  const validationErrors = validateResolvedMeasurements(doc.measurements);
  const measurements = doc.type === 'individual'
    ? doc.measurementOrder.map((name) => doc.measurements[name]).filter((measurement) => measurement !== undefined)
    : doc.multisizeMeasurementOrder.map((name) => doc.multisizeMeasurements[name]).filter((measurement) => measurement !== undefined);
  const present = measurements.filter((measurement) => measurement.hasValue).length;

  const graded = doc.type === 'multisize' && options.size !== null && options.height !== null
    ? Object.values(doc.multisizeMeasurements).map((measurement) => ({
        name: measurement.name,
        fullName: measurement.fullName,
        value: calculateMultisizeValue(doc, measurement.name, options.size as number, options.height as number),
      }))
    : [];

  return {
    ok: validationErrors.length === 0,
    file,
    filename: basename(file),
    extension: fileInfo.extension,
    type: doc.type,
    format: doc.format,
    modernExtension: fileInfo.modernExtension,
    version: doc.version,
    unit: doc.unit,
    readOnly: doc.readOnly,
    pmSystem: doc.pmSys,
    subject: [doc.personal['given-name'], doc.personal['family-name']].filter(Boolean).join(' '),
    counts: {
      total: measurements.length,
      present,
      missing: measurements.length - present,
      resolved: doc.type === 'individual'
        ? Object.values(doc.measurements).filter((measurement) => measurement.hasValue && measurement.resolved !== null).length
        : undefined,
      errors: validationErrors.length,
    },
    validationErrors,
    measurements,
    graded,
  };
}

function printReport(report: ReturnType<typeof buildReport>, options: CliOptions): void {
  console.log(`${report.ok ? 'OK' : 'INVALID'} ${report.filename}`);
  console.log(`Type: ${report.type} (${report.format}), save as *${report.modernExtension}`);
  console.log(`Version: ${report.version || '(missing)'}`);
  console.log(`Unit: ${report.unit || '(missing)'}`);
  if (report.subject) console.log(`Subject: ${report.subject}`);
  if (report.pmSystem) console.log(`PM system: ${report.pmSystem}`);
  console.log(`Measurements: ${report.counts.present}/${report.counts.total} present`);
  if (report.counts.resolved !== undefined) console.log(`Resolved: ${report.counts.resolved}`);
  console.log(`Errors: ${report.counts.errors}`);

  if (report.validationErrors.length > 0) {
    console.log('');
    console.log('Validation errors:');
    for (const error of report.validationErrors) console.log(`  - ${error}`);
  }

  if (options.list) {
    console.log('');
    console.log(report.type === 'individual' ? 'Measurements:' : 'Multisize measurements:');
    for (const measurement of report.measurements) {
      if (options.errorsOnly && !('error' in measurement && measurement.error)) continue;
      const id = measurement.id ? `[${measurement.id}] ` : '';
      if ('resolved' in measurement) {
        const value = measurement.resolved === null ? '-' : `${formatNumber(measurement.resolved)} ${report.unit}`.trim();
        const suffix = measurement.error ? ` ERROR: ${measurement.error}` : '';
        console.log(`  ${id}${measurement.name}: ${value} raw="${measurement.raw}"${suffix}`);
      } else {
        console.log(
          `  ${id}${measurement.name}: base=${formatMaybeNumber(measurement.base)} size_increase=${formatMaybeNumber(measurement.sizeIncrement)} height_increase=${formatMaybeNumber(measurement.heightIncrement)}`,
        );
      }
    }
  }

  if (report.graded.length > 0) {
    console.log('');
    console.log(`Graded values at size=${options.size}, height=${options.height}:`);
    for (const item of report.graded) {
      console.log(`  ${item.name}: ${formatMaybeNumber(item.value)} ${report.unit}`.trim());
    }
  }
}

function formatMaybeNumber(value: number | null): string {
  return value === null ? '-' : formatNumber(value);
}

function formatNumber(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, '');
}

function printHelp(): void {
  console.log(`Usage:
  seamlyme-core validate <file> [options]

Options:
  --list             Print parsed measurements.
  --errors-only      With --list, print only measurements with formula errors.
  --no-catalog       Do not add missing known Seamly measurements to individual files.
  --size <number>    Multisize target size for graded output.
  --height <number>  Multisize target height for graded output.
  --json             Print machine-readable JSON.

Examples:
  npm run cli -- validate ../example_measurements.smis
  npm run cli -- validate ../example_measurements.smis --list --no-catalog
  npm run cli -- validate ./table.smms --size 50 --height 180`);
}
