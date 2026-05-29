import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addMeasurement,
  buildDependencyGraph,
  calculateMultisizeValue,
  detectMeasurementFile,
  detectCycles,
  extractDependencies,
  findDependents,
  getMeasurement,
  listAll,
  listCustom,
  listKnown,
  loadMeasurementFile,
  modernExtensionForType,
  parseSmis,
  removeMeasurement,
  renameMeasurement,
  resolveAll,
  saveMeasurementFile,
  serializeSmis,
  setMeasurementMeta,
  setMeasurementValue,
  validateDocument,
  validateKnownNames,
  validateResolvedMeasurements,
} from '../src/core/index.js';

describe('SeamlyME core', () => {
  it('parses SMIS metadata and catalog-backed measurements', () => {
    const xml = readFileSync('../example_measurements.smis', 'utf8');
    const doc = parseSmis(xml, { filename: 'example_measurements.smis' });

    expect(doc.version).toBe('0.3.4');
    expect(doc.unit).toBe('inch');
    expect(doc.pmSys).toBe('998');
    expect(doc.personal['given-name']).toBe('Jane');
    expect(doc.measurements.height.id).toBe('A01');
    expect(doc.measurements.height.fullName).toBe('Height: Total');
    expect(doc.measurements.width_bust.hasValue).toBe(false);
  });

  it('resolves arithmetic formulas through the dependency graph', () => {
    const xml = readFileSync('../example_measurements.smis', 'utf8');
    const doc = parseSmis(xml);

    expect(doc.measurements.height_neck_back_to_knee.dependencies).toEqual([
      'height_knee',
      'height_neck_back',
    ]);
    expect(buildDependencyGraph(doc.measurements).height_neck_back_to_knee).toEqual([
      'height_knee',
      'height_neck_back',
    ]);
    expect(doc.measurements.height_neck_back_to_knee.resolved).toBe(40);
    expect(doc.measurements.arm_elbow_to_wrist_bent.resolved).toBe(9.5);
    expect(doc.measurements.arm_wrist_circ.resolved).toBe(6.25);
    expect(doc.measurements['@HJA_side_hip_depth'].resolved).toBe(9.75);
  });

  it('does not mutate the parsed document while serializing writable values', () => {
    const xml = readFileSync('../example_meas.smis', 'utf8');
    const doc = parseSmis(xml);
    const serialized = serializeSmis(doc);
    const reparsed = parseSmis(serialized);

    expect(doc.measurementOrder.slice(0, 5)).toEqual([
      'shoulder_length',
      'height_ankle_high',
      'arm_shoulder_tip_to_wrist_bent',
      'arm_shoulder_tip_to_elbow_bent',
      'arm_elbow_to_wrist_bent',
    ]);
    expect(serialized).toContain('<m name="arm_elbow_to_wrist_bent" value="(arm_shoulder_tip_to_wrist_bent - arm_shoulder_tip_to_elbow_bent)"/>');
    expect(serialized).not.toContain('width_bust');
    expect(reparsed.measurementOrder.slice(0, 5)).toEqual([
      'shoulder_length',
      'height_ankle_high',
      'arm_shoulder_tip_to_wrist_bent',
      'arm_shoulder_tip_to_elbow_bent',
      'arm_elbow_to_wrist_bent',
    ]);
    expect(reparsed.measurements.arm_elbow_to_wrist_bent.resolved).toBe(9.5);
    expect(reparsed.measurements['@HJA_side_hip_depth'].desc).toContain('\nform being measured');
  });

  it('preserves inserted individual measurement order during serialization', () => {
    const doc = parseSmis(
      '<smis><version>0.3.3</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="A" value="1"/><m name="C" value="3"/></body-measurements></smis>',
      { includeCatalog: false },
    );

    doc.measurements.B = {
      name: 'B',
      id: '',
      raw: '2',
      fullName: '',
      desc: '',
      resolved: 2,
      hasValue: true,
      dependencies: [],
      error: null,
    };
    doc.measurementOrder.splice(doc.measurementOrder.indexOf('A') + 1, 0, 'B');

    const reparsed = parseSmis(serializeSmis(doc), { includeCatalog: false });
    expect(reparsed.measurementOrder).toEqual(['A', 'B', 'C']);
    expect(serializeSmis(doc).indexOf('name="B"')).toBeGreaterThan(serializeSmis(doc).indexOf('name="A"'));
    expect(serializeSmis(doc).indexOf('name="B"')).toBeLessThan(serializeSmis(doc).indexOf('name="C"'));
  });

  it('extracts whole measurement names without prefix collisions', () => {
    expect(
      extractDependencies(
        'arm_shoulder_tip_to_wrist - arm_shoulder_tip_to_elbow',
        ['arm_shoulder_tip_to_wrist', 'arm_shoulder_tip_to_elbow', 'arm_shoulder_tip'],
      ),
    ).toEqual(['arm_shoulder_tip_to_elbow', 'arm_shoulder_tip_to_wrist']);
  });

  it('detects modern and legacy file extensions and save extensions', () => {
    expect(detectMeasurementFile('person.smis')).toMatchObject({
      type: 'individual',
      format: 'modern',
      modernExtension: '.smis',
    });
    expect(detectMeasurementFile('person.vit')).toMatchObject({
      type: 'individual',
      format: 'legacy',
      modernExtension: '.smis',
    });
    expect(detectMeasurementFile('table.smms')).toMatchObject({
      type: 'multisize',
      format: 'modern',
      modernExtension: '.smms',
    });
    expect(detectMeasurementFile('table.vst')).toMatchObject({
      type: 'multisize',
      format: 'legacy',
      modernExtension: '.smms',
    });
    expect(modernExtensionForType('individual')).toBe('.smis');
    expect(modernExtensionForType('multisize')).toBe('.smms');
  });

  it('parses the actual modern individual <smis> structure', () => {
    const doc = parseSmis(
      `<?xml version="1.0" encoding="UTF-8"?>
      <smis>
        <version>0.3.3</version>
        <read-only>false</read-only>
        <notes><![CDATA[User notes here]]></notes>
        <unit>cm</unit>
        <pm_system>p1</pm_system>
        <personal>
          <given-name>Jane</given-name>
          <family-name>Sample</family-name>
          <gender>female</gender>
          <birth-date>1990-01-01</birth-date>
          <email>jane@example.test</email>
        </personal>
        <body-measurements>
          <m name="G01" value="176" full_name="Height" description="Total height"/>
          <m name="@bust_circ" value="G01/2 + 4" full_name="Bust" description="Custom measurement"/>
        </body-measurements>
      </smis>`,
      { filename: 'person.smis', includeCatalog: false },
    );

    expect(doc.type).toBe('individual');
    expect(doc.format).toBe('modern');
    expect(doc.personal['given-name']).toBe('Jane');
    expect(doc.pmSys).toBe('p1');
    expect(doc.measurements.G01.resolved).toBe(176);
    expect(doc.measurements['@bust_circ'].dependencies).toEqual(['G01']);
    expect(doc.measurements['@bust_circ'].resolved).toBe(92);
    expect(validateResolvedMeasurements(doc.measurements)).toEqual([]);
  });

  it('parses and grades actual multisize <smms> measurements', () => {
    const doc = parseSmis(
      `<?xml version="1.0" encoding="UTF-8"?>
      <smms>
        <version>0.3.3</version>
        <unit>cm</unit>
        <read-only>false</read-only>
        <notes/>
        <size>48</size>
        <height>176</height>
        <body-measurements>
          <m name="G01" base="176" size_increase="0" height_increase="1" full_name="Height"/>
          <m name="G02" base="92" size_increase="2" height_increase="0.5" full_name="Bust"/>
        </body-measurements>
      </smms>`,
      { filename: 'table.smms' },
    );

    expect(doc.type).toBe('multisize');
    expect(doc.multisize).toEqual({ baseSize: 48, baseHeight: 176 });
    expect(doc.multisizeMeasurementOrder).toEqual(['G01', 'G02']);
    expect(doc.multisizeMeasurements.G01.base).toBe(176);
    expect(calculateMultisizeValue(doc, 'G01', 50, 180)).toBe(180);
    expect(calculateMultisizeValue(doc, 'G02', 50, 180)).toBe(98);

    const reparsed = parseSmis(serializeSmis(doc));
    expect(reparsed.multisizeMeasurementOrder).toEqual(['G01', 'G02']);
  });

  it('serializes individual and multisize documents to modern Seamly roots', () => {
    const individual = parseSmis(
      '<vit><version>0.3.3</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system>p1</pm_system><personal/><body-measurements><m name="G01" value="176"/></body-measurements></vit>',
      { filename: 'legacy.vit', includeCatalog: false },
    );
    const individualXml = serializeSmis(individual);

    expect(individual.format).toBe('legacy');
    expect(individualXml).toContain('<smis>');
    expect(individualXml).toContain('<pm_system>p1</pm_system>');
    expect(individualXml).toContain('<personal>');

    const multisize = parseSmis(
      '<vst><version>0.3.3</version><unit>cm</unit><read-only>false</read-only><notes/><size>48</size><height>176</height><body-measurements><m name="G01" base="176" size_increase="0" height_increase="1"/></body-measurements></vst>',
      { filename: 'legacy.vst' },
    );
    const multisizeXml = serializeSmis(multisize);

    expect(multisize.format).toBe('legacy');
    expect(multisizeXml).toContain('<smms>');
    expect(multisizeXml).toContain('<size>48</size>');
    expect(multisizeXml).toContain('<height>176</height>');
    expect(multisizeXml).toContain('height_increase="1"');
  });

  it('loads XML or paths and warns when extension and root disagree', () => {
    const loaded = loadMeasurementFile(
      '<vit><version>0.3.3</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="G01" value="176"/></body-measurements></vit>',
      'renamed.smis',
    );

    expect(loaded.document.type).toBe('individual');
    expect(loaded.document.format).toBe('legacy');
    expect(loaded.warnings.map((warning) => warning.code)).toContain('extension-root-format-mismatch');

    const dir = mkdirTemp();
    const file = join(dir, 'person.smis');
    try {
      saveMeasurementFile(loaded.document, { path: file });
      const fromPath = loadMeasurementFile(file);
      expect(fromPath.document.format).toBe('modern');
      expect(fromPath.warnings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('saves modern roots and warns about non-modern save extensions', () => {
    const doc = parseSmis(
      '<vit><version>0.3.3</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="G01" value="176"/></body-measurements></vit>',
      { includeCatalog: false },
    );

    const dir = mkdirTemp();
    try {
      const saved = saveMeasurementFile(doc, { path: join(dir, 'legacy.vit') });
      expect(saved.xml).toContain('<smis>');
      expect(saved.xml).not.toContain('<vit>');
      expect(saved.warnings).toEqual([
        expect.objectContaining({ code: 'save-extension-mismatch' }),
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('gets and edits individual measurements, then resolves values', () => {
    const doc = parseSmis(
      '<smis><version>0.3.3</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="height" value="100"/></body-measurements></smis>',
      { includeCatalog: false },
    );

    expect(getMeasurement(doc, 'height')?.name).toBe('height');
    addMeasurement(doc, '@half_height', 'height / 2');
    expect(doc.measurementOrder).toEqual(['height', '@half_height']);
    expect(doc.measurements['@half_height'].resolved).toBe(50);

    setMeasurementValue(doc, 'height', 120);
    expect(doc.measurements['@half_height'].resolved).toBe(60);

    setMeasurementMeta(doc, '@half_height', {
      fullName: 'Half height',
      description: 'Derived test measurement',
    });
    expect(doc.measurements['@half_height'].fullName).toBe('Half height');
    expect(doc.measurements['@half_height'].desc).toBe('Derived test measurement');
  });

  it('removes and renames measurements while updating formula references', () => {
    const doc = parseSmis(
      '<smis><version>0.3.3</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="@a" value="10"/><m name="@b" value="@a + 5"/><m name="@c" value="@b + 1"/></body-measurements></smis>',
      { includeCatalog: false },
    );

    renameMeasurement(doc, '@a', '@renamed');
    expect(doc.measurementOrder).toEqual(['@renamed', '@b', '@c']);
    expect(doc.measurements['@b'].raw).toBe('@renamed + 5');
    expect(doc.measurements['@c'].resolved).toBe(16);

    removeMeasurement(doc, '@b');
    expect(doc.measurementOrder).toEqual(['@renamed', '@c']);
    expect(doc.measurements['@b']).toBeUndefined();
    expect(doc.measurements['@c'].resolved).toBeNull();
  });

  it('lists all, known, and custom measurements in document order', () => {
    const doc = parseSmis(
      '<smis><version>0.3.3</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="height" value="100"/><m name="@custom" value="20"/><m name="G01" value="176"/></body-measurements></smis>',
      { includeCatalog: false },
    );

    expect(listAll(doc).map((measurement) => measurement.name)).toEqual(['height', '@custom', 'G01']);
    expect(listKnown(doc).map((measurement) => measurement.name)).toEqual(['height', 'G01']);
    expect(listCustom(doc).map((measurement) => measurement.name)).toEqual(['@custom']);
  });

  it('validates known names and returns structured document issues', () => {
    const doc = parseSmis(
      '<smis><version></version><unit>yards</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="not_known" value="1"/><m name="@custom" value="missing + 1"/></body-measurements></smis>',
      { includeCatalog: false },
    );

    expect(validateKnownNames(doc)).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'unknown-measurement-name',
        measurement: 'not_known',
      }),
    ]);
    expect(validateDocument(doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-version', severity: 'warning' }),
      expect.objectContaining({ code: 'unsupported-unit', severity: 'error' }),
      expect.objectContaining({ code: 'unknown-measurement-name', measurement: 'not_known' }),
      expect.objectContaining({ code: 'formula-error', measurement: '@custom' }),
    ]));
  });

  it('builds document dependency graphs, finds dependents, detects cycles, and resolves all', () => {
    const doc = parseSmis(
      '<smis><version>0.3.3</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="@a" value="@c + 1"/><m name="@b" value="@a + 1"/><m name="@c" value="@b + 1"/></body-measurements></smis>',
      { includeCatalog: false },
    );

    expect(buildDependencyGraph(doc)).toEqual({
      '@a': ['@c'],
      '@b': ['@a'],
      '@c': ['@b'],
    });
    expect(findDependents(doc, '@a')).toEqual(['@b']);
    expect(detectCycles(doc)).toEqual([['@a', '@c', '@b', '@a']]);
    expect(validateDocument(doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'circular-dependency' }),
    ]));

    setMeasurementValue(doc, '@a', '1');
    resolveAll(doc);
    expect(detectCycles(doc)).toEqual([]);
    expect(doc.measurements['@c'].resolved).toBe(3);
  });
});

function mkdirTemp(): string {
  return mkdirSync(join(tmpdir(), `seamlyme-core-${Date.now()}-${Math.random().toString(16).slice(2)}`), {
    recursive: true,
  });
}
