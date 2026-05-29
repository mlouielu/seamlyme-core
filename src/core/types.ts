export type SeamlyUnit = 'mm' | 'cm' | 'inch' | string;
export type MeasurementFileType = 'individual' | 'multisize';
export type MeasurementFormat = 'modern' | 'legacy';

export interface SeamlyPersonalInfo {
  'family-name': string;
  'given-name': string;
  'birth-date': string;
  gender: string;
  email: string;
}

export interface SeamlyMeasurementDefinition {
  id: string;
  name: string;
  fullName: string;
}

export interface SeamlyMeasurement {
  name: string;
  id: string;
  raw: string;
  fullName: string;
  desc: string;
  resolved: number | null;
  hasValue: boolean;
  dependencies: string[];
  error: string | null;
}

export interface SeamlyMultisizeMeasurement {
  name: string;
  id: string;
  base: number | null;
  sizeIncrement: number | null;
  heightIncrement: number | null;
  fullName: string;
  desc: string;
  hasValue: boolean;
}

export interface SeamlyMultisizeSystem {
  baseSize: number | null;
  baseHeight: number | null;
}

export interface SeamlyDocument {
  type: MeasurementFileType;
  format: MeasurementFormat;
  version: string;
  readOnly: boolean;
  notes: string;
  unit: SeamlyUnit;
  pmSys: string;
  personal: SeamlyPersonalInfo;
  measurements: Record<string, SeamlyMeasurement>;
  measurementOrder: string[];
  multisize: SeamlyMultisizeSystem | null;
  multisizeMeasurements: Record<string, SeamlyMultisizeMeasurement>;
  multisizeMeasurementOrder: string[];
}

export interface ParseSmisOptions {
  includeCatalog?: boolean;
  filename?: string;
  type?: MeasurementFileType;
}

export interface SerializeSmisOptions {
  includeMissingCatalogMeasurements?: boolean;
}

export interface MeasurementFileInfo {
  extension: string;
  type: MeasurementFileType;
  format: MeasurementFormat;
  modernExtension: '.smis' | '.smms';
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  measurement?: string;
}

export interface MeasurementFileWarning {
  code: string;
  message: string;
}

export interface LoadedMeasurementFile {
  document: SeamlyDocument;
  warnings: MeasurementFileWarning[];
}

export interface SaveMeasurementFileOptions extends SerializeSmisOptions {
  path?: string;
}

export interface SavedMeasurementFile {
  xml: string;
  warnings: MeasurementFileWarning[];
}

export interface MeasurementMetaPatch {
  fullName?: string;
  description?: string;
}

export type MeasurementMoveDirection = 'top' | 'up' | 'down' | 'bottom';

export interface MeasurementValuePatch {
  value?: string | number;
  fullName?: string;
  description?: string;
}

export interface DocumentPatch {
  version?: string;
  readOnly?: boolean;
  notes?: string;
  unit?: SeamlyUnit;
  pmSys?: string;
  personal?: Partial<SeamlyPersonalInfo>;
  measurements?: Record<string, MeasurementValuePatch>;
}

export interface NameConflictResolution {
  requested: string;
  resolved: string;
  changed: boolean;
}

export interface MeasurementRow {
  index: number;
  id: string;
  name: string;
  label: string;
  description: string;
  raw: string;
  value: number | null;
  unit: SeamlyUnit;
  hasValue: boolean;
  isResolved: boolean;
  isKnown: boolean;
  isCustom: boolean;
  dependencies: string[];
  dependents: string[];
  error: string | null;
}
