/**
 * Supported measurement units in SeamlyMe.
 *
 * @example
 * ```typescript
 * const unit: SeamlyUnit = 'cm';
 * ```
 */
export type SeamlyUnit = 'mm' | 'cm' | 'inch' | string;

/**
 * The type of measurement file.
 * - `individual`: Contains fixed measurements for a specific person.
 * - `multisize`: Contains base measurements and increments for different sizes/heights.
 *
 * @example
 * ```typescript
 * const type: MeasurementFileType = 'individual';
 * ```
 */
export type MeasurementFileType = 'individual' | 'multisize';

/**
 * The format version of the measurement file.
 * - `modern`: SeamlyMe XML format (.smis, .smms).
 * - `legacy`: Valentina/old Seamly2D format (.vit, .vst).
 *
 * @example
 * ```typescript
 * const format: MeasurementFormat = 'modern';
 * ```
 */
export type MeasurementFormat = 'modern' | 'legacy';

/**
 * Personal information of the person being measured.
 *
 * @example
 * ```typescript
 * const info: SeamlyPersonalInfo = {
 *   'family-name': 'Doe',
 *   'given-name': 'Jane',
 *   'birth-date': '1990-01-01',
 *   gender: 'female',
 *   email: 'jane.doe@example.com'
 * };
 * ```
 */
export interface SeamlyPersonalInfo {
  /** Family name or surname. */
  'family-name': string;
  /** Given name or first name. */
  'given-name': string;
  /** Date of birth in YYYY-MM-DD format. */
  'birth-date': string;
  /** Gender or sex. */
  gender: string;
  /** Contact email address. */
  email: string;
}

/**
 * Definition of a standard measurement from the SeamlyMe catalog.
 *
 * @example
 * ```typescript
 * const def: SeamlyMeasurementDefinition = {
 *   id: 'G04',
 *   name: 'bust_circ',
 *   fullName: 'Bust circumference'
 * };
 * ```
 */
export interface SeamlyMeasurementDefinition {
  /** The standard Seamly ID (e.g., 'G04'). */
  id: string;
  /** The internal variable name (e.g., 'bust_circ'). */
  name: string;
  /** Human-readable full name (e.g., 'Bust circumference'). */
  fullName: string;
}

/**
 * An individual measurement record.
 *
 * @example
 * ```typescript
 * const measurement: SeamlyMeasurement = {
 *   name: 'bust_circ',
 *   id: 'G04',
 *   raw: '90',
 *   fullName: 'Bust circumference',
 *   desc: 'Measured at the fullest part',
 *   resolved: 90,
 *   hasValue: true,
 *   dependencies: [],
 *   error: null
 * };
 * ```
 */
export interface SeamlyMeasurement {
  /** Internal variable name. */
  name: string;
  /** Standard Seamly ID, if applicable. */
  id: string;
  /** The raw formula or value string. */
  raw: string;
  /** Human-readable full name. */
  fullName: string;
  /** Optional description or notes. */
  desc: string;
  /** The calculated numeric value, or null if unresolvable. */
  resolved: number | null;
  /** Whether a value or formula has been provided. */
  hasValue: boolean;
  /** List of other measurement names this one depends on. */
  dependencies: string[];
  /** Error message if the formula failed to resolve. */
  error: string | null;
}

/**
 * A multisize measurement record.
 * Contains base values and increments for scaling across sizes and heights.
 *
 * @example
 * ```typescript
 * const measurement: SeamlyMultisizeMeasurement = {
 *   name: 'bust_circ',
 *   id: 'G04',
 *   base: 90,
 *   sizeIncrement: 4,
 *   heightIncrement: 0,
 *   fullName: 'Bust circumference',
 *   desc: '',
 *   hasValue: true
 * };
 * ```
 */
export interface SeamlyMultisizeMeasurement {
  /** Internal variable name. */
  name: string;
  /** Standard Seamly ID, if applicable. */
  id: string;
  /** The measurement value for the base size and height. */
  base: number | null;
  /** Increment to add per unit of size increase. */
  sizeIncrement: number | null;
  /** Increment to add per unit of height increase. */
  heightIncrement: number | null;
  /** Human-readable full name. */
  fullName: string;
  /** Optional description or notes. */
  desc: string;
  /** Whether a base value has been provided. */
  hasValue: boolean;
}

/**
 * Configuration for a multisize measurement system.
 *
 * @example
 * ```typescript
 * const sys: SeamlyMultisizeSystem = {
 *   baseSize: 38,
 *   baseHeight: 164
 * };
 * ```
 */
export interface SeamlyMultisizeSystem {
  /** The size used as the baseline (e.g., 38). */
  baseSize: number | null;
  /** The height used as the baseline (e.g., 164). */
  baseHeight: number | null;
}

/**
 * The root document structure for SeamlyMe measurements.
 * Represents either an individual (.smis) or multisize (.smms) file.
 *
 * @example
 * ```typescript
 * const doc: SeamlyDocument = {
 *   type: 'individual',
 *   format: 'modern',
 *   version: '0.6.0',
 *   readOnly: false,
 *   notes: '',
 *   unit: 'cm',
 *   pmSys: 'standard',
 *   personal: { ... },
 *   measurements: { ... },
 *   measurementOrder: [ 'bust_circ', ... ],
 *   multisize: null,
 *   multisizeMeasurements: {},
 *   multisizeMeasurementOrder: []
 * };
 * ```
 */
export interface SeamlyDocument {
  /** Whether this is an 'individual' or 'multisize' document. */
  type: MeasurementFileType;
  /** The file format (modern or legacy). */
  format: MeasurementFormat;
  /** File format version string. */
  version: string;
  /** Whether the file is marked as read-only. */
  readOnly: boolean;
  /** General notes or metadata about the file. */
  notes: string;
  /** The measurement unit used throughout the document. */
  unit: SeamlyUnit;
  /** The pattern making system name. */
  pmSys: string;
  /** Personal information for individual documents. */
  personal: SeamlyPersonalInfo;
  /** Map of individual measurements by name. */
  measurements: Record<string, SeamlyMeasurement>;
  /** Ordered list of measurement names for individual documents. */
  measurementOrder: string[];
  /** Multisize system configuration, if type is 'multisize'. */
  multisize: SeamlyMultisizeSystem | null;
  /** Map of multisize measurements by name. */
  multisizeMeasurements: Record<string, SeamlyMultisizeMeasurement>;
  /** Ordered list of measurement names for multisize documents. */
  multisizeMeasurementOrder: string[];
}

/**
 * Options for `createDocument`.
 *
 * @example
 * ```typescript
 * const doc = createDocument({ unit: 'inch', template: 'default' });
 * ```
 */
export interface CreateDocumentOptions {
  /** Whether this is an 'individual' or 'multisize' document. Default: 'individual'. */
  type?: MeasurementFileType;
  /** Measurement unit. Default: 'cm'. */
  unit?: SeamlyUnit;
  /** General notes or metadata. Default: ''. */
  notes?: string;
  /** Whether the file is read-only. Default: false. */
  readOnly?: boolean;
  /** Pattern making system identifier. Default: '998'. */
  pmSys?: string;
  /** Personal information for individual documents. */
  personal?: Partial<SeamlyPersonalInfo>;
  /** Multisize system configuration (only for type: 'multisize'). */
  multisize?: Partial<SeamlyMultisizeSystem>;
  /** If true, creates a document with no measurements at all. Default: false. */
  empty?: boolean;
  /**
   * Named built-in template (e.g. 'default') or a file path to a .smis file.
   * Overlays pre-filled formulas onto catalog measurements.
   */
  template?: string;
}

/**
 * Options for parsing Seamly XML measurement files.
 *
 * @example
 * ```typescript
 * const options: ParseSmisOptions = {
 *   includeCatalog: true,
 *   type: 'individual'
 * };
 * ```
 */
export interface ParseSmisOptions {
  /** Whether to populate the document with all known measurements from the catalog. */
  includeCatalog?: boolean;
  /** Optional filename for better error messages and type inference. */
  filename?: string;
  /** Force a specific measurement file type. */
  type?: MeasurementFileType;
}

/**
 * Options for serializing a Seamly document back to XML.
 *
 * @example
 * ```typescript
 * const options: SerializeSmisOptions = {
 *   includeMissingCatalogMeasurements: false
 * };
 * ```
 */
export interface SerializeSmisOptions {
  /** If true, includes all catalog measurements even if they have no value. */
  includeMissingCatalogMeasurements?: boolean;
}

/**
 * Information about a measurement file inferred from its metadata.
 *
 * @example
 * ```typescript
 * const info: MeasurementFileInfo = {
 *   extension: '.smis',
 *   type: 'individual',
 *   format: 'modern',
 *   modernExtension: '.smis'
 * };
 * ```
 */
export interface MeasurementFileInfo {
  /** The file extension (e.g., '.smis', '.vit'). */
  extension: string;
  /** The inferred file type. */
  type: MeasurementFileType;
  /** The inferred file format. */
  format: MeasurementFormat;
  /** The appropriate modern extension for this file type. */
  modernExtension: '.smis' | '.smms';
}

/**
 * Severity levels for validation issues.
 *
 * @example
 * ```typescript
 * const severity: ValidationSeverity = 'error';
 * ```
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * Represents a problem found during document validation.
 *
 * @example
 * ```typescript
 * const issue: ValidationIssue = {
 *   severity: 'error',
 *   code: 'circular-dependency',
 *   message: 'A depends on B, B depends on A',
 *   measurement: 'A'
 * };
 * ```
 */
export interface ValidationIssue {
  /** The severity of the issue. */
  severity: ValidationSeverity;
  /** Machine-readable error code. */
  code: string;
  /** Human-readable description of the problem. */
  message: string;
  /** The name of the measurement associated with this issue, if any. */
  measurement?: string;
}

/**
 * A warning encountered during the file loading process.
 *
 * @example
 * ```typescript
 * const warning: MeasurementFileWarning = {
 *   code: 'extension-root-type-mismatch',
 *   message: 'Extension .smis implies individual, but XML root is multisize'
 * };
 * ```
 */
export interface MeasurementFileWarning {
  /** Machine-readable warning code. */
  code: string;
  /** Human-readable warning message. */
  message: string;
}

/**
 * The result of loading a measurement file.
 *
 * @example
 * ```typescript
 * const result: LoadedMeasurementFile = {
 *   document: myDoc,
 *   warnings: []
 * };
 * ```
 */
export interface LoadedMeasurementFile {
  /** The parsed Seamly document. */
  document: SeamlyDocument;
  /** Any warnings encountered during loading (e.g., extension/content mismatch). */
  warnings: MeasurementFileWarning[];
}

/**
 * Options for saving a measurement file to disk or as a string.
 *
 * @example
 * ```typescript
 * const options: SaveMeasurementFileOptions = {
 *   path: 'my-measurements.smis',
 *   includeMissingCatalogMeasurements: true
 * };
 * ```
 */
export interface SaveMeasurementFileOptions extends SerializeSmisOptions {
  /** Optional file path to write the XML to. */
  path?: string;
}

/**
 * The result of saving a measurement file.
 *
 * @example
 * ```typescript
 * const result: SavedMeasurementFile = {
 *   xml: '<?xml ...',
 *   warnings: []
 * };
 * ```
 */
export interface SavedMeasurementFile {
  /** The generated XML content. */
  xml: string;
  /** Any warnings generated during the save process. */
  warnings: MeasurementFileWarning[];
}

/**
 * A patch object for updating measurement metadata.
 *
 * @example
 * ```typescript
 * const patch: MeasurementMetaPatch = {
 *   fullName: 'Updated Name',
 *   description: 'New notes'
 * };
 * ```
 */
export interface MeasurementMetaPatch {
  /** The new full name for the measurement. */
  fullName?: string;
  /** The new description for the measurement. */
  description?: string;
}

/**
 * Directions for moving a measurement within the list.
 *
 * @example
 * ```typescript
 * const direction: MeasurementMoveDirection = 'up';
 * ```
 */
export type MeasurementMoveDirection = 'top' | 'up' | 'down' | 'bottom';

/**
 * A patch object for updating a measurement's value and metadata.
 *
 * @example
 * ```typescript
 * const patch: MeasurementValuePatch = {
 *   value: '95',
 *   description: 'Measured again'
 * };
 * ```
 */
export interface MeasurementValuePatch {
  /** The new value or formula string. */
  value?: string | number;
  /** The new full name. */
  fullName?: string;
  /** The new description. */
  description?: string;
}

/**
 * A patch object for updating multiple aspects of a Seamly document.
 *
 * @example
 * ```typescript
 * const patch: DocumentPatch = {
 *   unit: 'cm',
 *   measurements: {
 *     'bust_circ': { value: '92' }
 *   }
 * };
 * ```
 */
export interface DocumentPatch {
  /** Update the file format version. */
  version?: string;
  /** Update the read-only status. */
  readOnly?: boolean;
  /** Update the general notes. */
  notes?: string;
  /** Update the measurement units. */
  unit?: SeamlyUnit;
  /** Update the pattern making system. */
  pmSys?: string;
  /** Update personal information fields. */
  personal?: Partial<SeamlyPersonalInfo>;
  /** Update specific measurements by name. */
  measurements?: Record<string, MeasurementValuePatch>;
}

/**
 * The result of a name conflict resolution attempt.
 *
 * @example
 * ```typescript
 * const resolution: NameConflictResolution = {
 *   requested: 'bust_circ',
 *   resolved: 'bust_circ_1',
 *   changed: true
 * };
 * ```
 */
export interface NameConflictResolution {
  /** The name that was originally requested. */
  requested: string;
  /** The final name that was decided upon. */
  resolved: string;
  /** Whether the name had to be changed to avoid a conflict. */
  changed: boolean;
}

/**
 * A flat, simplified representation of a measurement for UI display (e.g., in a table).
 *
 * @example
 * ```typescript
 * const row: MeasurementRow = {
 *   index: 0,
 *   id: 'G04',
 *   name: 'bust_circ',
 *   label: 'Bust circumference',
 *   description: '',
 *   raw: '90',
 *   value: 90,
 *   unit: 'cm',
 *   hasValue: true,
 *   isResolved: true,
 *   isKnown: true,
 *   isCustom: false,
 *   dependencies: [],
 *   dependents: [],
 *   error: null
 * };
 * ```
 */
export interface MeasurementRow {
  /** Position in the list. */
  index: number;
  /** Seamly ID. */
  id: string;
  /** Internal variable name. */
  name: string;
  /** Display label (fullName or name). */
  label: string;
  /** Notes or description. */
  description: string;
  /** The raw input formula or value. */
  raw: string;
  /** The calculated numeric result. */
  value: number | null;
  /** The unit of measurement. */
  unit: SeamlyUnit;
  /** Whether any value has been entered. */
  hasValue: boolean;
  /** Whether the formula has been successfully calculated. */
  isResolved: boolean;
  /** Whether this is a standard Seamly measurement. */
  isKnown: boolean;
  /** Whether this is a custom user-defined measurement. */
  isCustom: boolean;
  /** Names of measurements that this one depends on. */
  dependencies: string[];
  /** Names of measurements that depend on this one. */
  dependents: string[];
  /** Error message if calculation failed. */
  error: string | null;
}
