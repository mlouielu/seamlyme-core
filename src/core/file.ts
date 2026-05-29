import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {
  detectMeasurementFile,
  modernExtensionForType,
  parseSmis,
  serializeSmis,
} from './smis.js';
import type {
  LoadedMeasurementFile,
  MeasurementFileType,
  MeasurementFileWarning,
  SavedMeasurementFile,
  SaveMeasurementFileOptions,
  SeamlyDocument,
} from './types.js';

export function loadMeasurementFile(
  input: string,
  filename?: string,
): LoadedMeasurementFile {
  const xml =
    looksLikeXml(input) || !existsSync(input)
      ? input
      : readFileSync(input, 'utf8');
  const effectiveFilename =
    filename ?? (looksLikeXml(input) ? undefined : input);
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

  return {document: doc, warnings};
}

export function saveMeasurementFile(
  doc: SeamlyDocument,
  options: SaveMeasurementFileOptions = {},
): SavedMeasurementFile {
  const xml = serializeSmis(doc, options);
  const warnings =
    options.path &&
    !options.path.toLowerCase().endsWith(modernExtensionForType(doc.type))
      ? [
          {
            code: 'save-extension-mismatch',
            message: `Modern ${doc.type} measurements should be saved as *${modernExtensionForType(doc.type)}.`,
          },
        ]
      : [];

  if (options.path) writeFileSync(options.path, xml, 'utf8');
  return {xml, warnings};
}

function detectFileWarnings(
  xml: string,
  filename?: string,
): MeasurementFileWarning[] {
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

function detectMeasurementRoot(xml: string): {
  name: 'smis' | 'smms' | 'vit' | 'vst';
  type: MeasurementFileType;
  format: 'modern' | 'legacy';
} | null {
  const match = xml.match(/<\s*(smis|smms|vit|vst)(?:\s|>)/i);
  if (!match) return null;
  const name = match[1].toLowerCase() as 'smis' | 'smms' | 'vit' | 'vst';
  return {
    name,
    type: name === 'smms' || name === 'vst' ? 'multisize' : 'individual',
    format: name === 'vit' || name === 'vst' ? 'legacy' : 'modern',
  };
}

function looksLikeXml(input: string): boolean {
  return input.trimStart().startsWith('<');
}
