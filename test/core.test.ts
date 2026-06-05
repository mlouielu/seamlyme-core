import {mkdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  addMeasurement,
  addMeasurementAfter,
  buildDependencyGraph,
  calculateMultisizeValue,
  cloneDocument,
  detectMeasurementFile,
  detectCycles,
  extractDependencies,
  findDependents,
  getMeasurement,
  getMeasurementRows,
  listAll,
  listCustom,
  listKnown,
  loadMeasurementFile,
  modernExtensionForType,
  moveMeasurement,
  moveMeasurements,
  reorderByDependencies,
  removeMeasurement,
  parseSmis,
  renameMeasurement,
  resolveMeasurementNameConflict,
  resolveAll,
  saveMeasurementFile,
  serializeSmis,
  setMeasurementMeta,
  setMeasurementValue,
  updateDocument,
  validateDocument,
  validateKnownNames,
  validateResolvedMeasurements,
  SEAMLYME_FORMAT_VERSION,
} from '../src/core/index.js';
import {generateFullBodySmis, generateSmisXml} from './generator.js';

describe('SeamlyME core', () => {
  it('handles various generated measurement file complexities', () => {
    const empty = parseSmis(generateSmisXml({complexity: 'empty'}), {
      includeCatalog: false,
    });
    expect(empty.measurementOrder).toHaveLength(0);

    const some = parseSmis(generateSmisXml({complexity: 'some'}), {
      includeCatalog: false,
    });
    expect(some.measurementOrder.length).toBeGreaterThan(0);

    const errors = parseSmis(generateSmisXml({complexity: 'errors'}), {
      includeCatalog: false,
    });
    expect(validateDocument(errors).length).toBeGreaterThan(0);
    expect(errors.measurements['@missing'].error).toContain(
      'Unresolved dependency',
    );
  });

  it('parses SMIS metadata and catalog-backed measurements', () => {
    const xml = generateFullBodySmis();
    const doc = parseSmis(xml, {filename: 'full_body.smis'});

    expect(doc.version).toBe(SEAMLYME_FORMAT_VERSION);
    expect(doc.unit).toBe('cm');
    expect(doc.pmSys).toBe('998');
    expect(doc.personal['given-name']).toBe('Full');
    expect(doc.measurements.height.id).toBe('A01');
    expect(doc.measurements.height.fullName).toBe('Height: Total');
    expect(doc.measurements.width_bust.hasValue).toBe(false);
  });

  it('resolves arithmetic formulas through the dependency graph', () => {
    const xml = generateFullBodySmis();
    const doc = parseSmis(xml);

    expect(doc.measurements['@waist_to_hip'].dependencies).toEqual([
      'hip_circ',
      'waist_circ',
    ]);
    expect(buildDependencyGraph(doc.measurements)['@waist_to_hip']).toEqual([
      'hip_circ',
      'waist_circ',
    ]);
    expect(doc.measurements['@waist_to_hip'].resolved).toBe(26);
    expect(doc.measurements['@total_arm'].resolved).toBe(69.5);
  });

  it('does not mutate the parsed document while serializing writable values', () => {
    const xml = generateFullBodySmis();
    const doc = parseSmis(xml);
    const serialized = serializeSmis(doc);
    const reparsed = parseSmis(serialized);

    expect(doc.measurementOrder.slice(0, 5)).toEqual([
      'height',
      'bust_circ',
      'waist_circ',
      'hip_circ',
      'shoulder_length',
    ]);
    expect(serialized).toContain(
      '<m name="@waist_to_hip" value="hip_circ - waist_circ"',
    );
    expect(serialized).not.toContain('width_bust');
    expect(reparsed.measurementOrder.slice(0, 5)).toEqual([
      'height',
      'bust_circ',
      'waist_circ',
      'hip_circ',
      'shoulder_length',
    ]);
    expect(reparsed.measurements['@waist_to_hip'].resolved).toBe(26);
    expect(reparsed.notes).toContain('Full body');
  });

  it('resolves complex ternary expressions (regression)', () => {
    const expression =
      'bust_circ>0?((((bust_circ-76)/4)*2)+6):waist_circ>0?(((waist_circ-56)/4)*2)+6:hip_circ>0?((((hip_circ-82)/4)*2)+6):6';

    const doc = parseSmis(
      `<smis>
        <version>0.3.4</version>
        <body-measurements>
          <m name="bust_circ" value="88"/>
          <m name="waist_circ" value="0"/>
          <m name="hip_circ" value="0"/>
          <m name="@formula" value="${expression}"/>
        </body-measurements>
      </smis>`,
      {includeCatalog: false},
    );

    // ((88-76)/4)*2 + 6 = (12/4)*2 + 6 = 3*2 + 6 = 12
    expect(doc.measurements['@formula'].error).toBeNull();
    expect(doc.measurements['@formula'].resolved).toBe(12);

    // Test with waist_circ instead
    doc.measurements.bust_circ.raw = '0';
    doc.measurements.waist_circ.raw = '68';
    resolveAll(doc);
    // ((68-56)/4)*2 + 6 = (12/4)*2 + 6 = 12
    expect(doc.measurements['@formula'].resolved).toBe(12);

    // Test default
    doc.measurements.waist_circ.raw = '0';
    resolveAll(doc);
    expect(doc.measurements['@formula'].resolved).toBe(6);
  });

  it('preserves inserted individual measurement order during serialization', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="A" value="1"/><m name="C" value="3"/></body-measurements></smis>',
      {includeCatalog: false},
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

    const reparsed = parseSmis(serializeSmis(doc), {includeCatalog: false});
    expect(reparsed.measurementOrder).toEqual(['A', 'B', 'C']);
    expect(serializeSmis(doc).indexOf('name="B"')).toBeGreaterThan(
      serializeSmis(doc).indexOf('name="A"'),
    );
    expect(serializeSmis(doc).indexOf('name="B"')).toBeLessThan(
      serializeSmis(doc).indexOf('name="C"'),
    );
  });

  it('extracts whole measurement names without prefix collisions', () => {
    expect(
      extractDependencies(
        'arm_shoulder_tip_to_wrist - arm_shoulder_tip_to_elbow',
        [
          'arm_shoulder_tip_to_wrist',
          'arm_shoulder_tip_to_elbow',
          'arm_shoulder_tip',
        ],
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
        <version>0.3.4</version>
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
      {filename: 'person.smis', includeCatalog: false},
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
        <version>0.3.4</version>
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
      {filename: 'table.smms'},
    );

    expect(doc.type).toBe('multisize');
    expect(doc.multisize).toEqual({baseSize: 48, baseHeight: 176});
    expect(doc.multisizeMeasurementOrder).toEqual(['G01', 'G02']);
    expect(doc.multisizeMeasurements.G01.base).toBe(176);
    expect(calculateMultisizeValue(doc, 'G01', 50, 180)).toBe(180);
    expect(calculateMultisizeValue(doc, 'G02', 50, 180)).toBe(98);

    const reparsed = parseSmis(serializeSmis(doc));
    expect(reparsed.multisizeMeasurementOrder).toEqual(['G01', 'G02']);
  });

  it('serializes individual and multisize documents to modern Seamly roots', () => {
    const individual = parseSmis(
      '<vit><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system>p1</pm_system><personal/><body-measurements><m name="G01" value="176"/></body-measurements></vit>',
      {filename: 'legacy.vit', includeCatalog: false},
    );
    const individualXml = serializeSmis(individual);

    expect(individual.format).toBe('legacy');
    expect(individualXml).toContain('<smis>');
    expect(individualXml).toContain('<pm_system>p1</pm_system>');
    expect(individualXml).toContain('<personal>');

    const multisize = parseSmis(
      '<vst><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><size>48</size><height>176</height><body-measurements><m name="G01" base="176" size_increase="0" height_increase="1"/></body-measurements></vst>',
      {filename: 'legacy.vst'},
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
      '<vit><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="G01" value="176"/></body-measurements></vit>',
      'renamed.smis',
    );

    expect(loaded.document.type).toBe('individual');
    expect(loaded.document.format).toBe('legacy');
    expect(loaded.warnings.map(warning => warning.code)).toContain(
      'extension-root-format-mismatch',
    );

    const dir = mkdirTemp();
    const file = join(dir, 'person.smis');
    try {
      saveMeasurementFile(loaded.document, {path: file});
      const fromPath = loadMeasurementFile(file);
      expect(fromPath.document.format).toBe('modern');
      expect(fromPath.warnings).toEqual([]);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it('saves modern roots and warns about non-modern save extensions', () => {
    const doc = parseSmis(
      '<vit><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="G01" value="176"/></body-measurements></vit>',
      {includeCatalog: false},
    );

    const dir = mkdirTemp();
    try {
      const saved = saveMeasurementFile(doc, {path: join(dir, 'legacy.vit')});
      expect(saved.xml).toContain('<smis>');
      expect(saved.xml).not.toContain('<vit>');
      expect(saved.warnings).toEqual([
        expect.objectContaining({code: 'save-extension-mismatch'}),
      ]);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it('gets and edits individual measurements, then resolves values', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="height" value="100"/></body-measurements></smis>',
      {includeCatalog: false},
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
    expect(doc.measurements['@half_height'].desc).toBe(
      'Derived test measurement',
    );
  });

  it('removes and renames measurements while updating formula references', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="@a" value="10"/><m name="@b" value="@a + 5"/><m name="@c" value="@b + 1"/></body-measurements></smis>',
      {includeCatalog: false},
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
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="height" value="100"/><m name="@custom" value="20"/><m name="G01" value="176"/></body-measurements></smis>',
      {includeCatalog: false},
    );

    expect(listAll(doc).map(measurement => measurement.name)).toEqual([
      'height',
      '@custom',
      'G01',
    ]);
    expect(listKnown(doc).map(measurement => measurement.name)).toEqual([
      'height',
      'G01',
    ]);
    expect(listCustom(doc).map(measurement => measurement.name)).toEqual([
      '@custom',
    ]);
  });

  it('validates known names and returns structured document issues', () => {
    const doc = parseSmis(
      '<smis><version></version><unit>yards</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="not_known" value="1"/><m name="@custom" value="missing + 1"/></body-measurements></smis>',
      {includeCatalog: false},
    );

    expect(validateKnownNames(doc)).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'unknown-measurement-name',
        measurement: 'not_known',
      }),
    ]);
    expect(validateDocument(doc)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({code: 'missing-version', severity: 'warning'}),
        expect.objectContaining({code: 'unsupported-unit', severity: 'error'}),
        expect.objectContaining({
          code: 'unknown-measurement-name',
          measurement: 'not_known',
        }),
        expect.objectContaining({
          code: 'formula-error',
          measurement: '@custom',
        }),
      ]),
    );
  });

  it('builds document dependency graphs, finds dependents, detects cycles, and resolves all', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="@a" value="@c + 1"/><m name="@b" value="@a + 1"/><m name="@c" value="@b + 1"/></body-measurements></smis>',
      {includeCatalog: false},
    );

    expect(buildDependencyGraph(doc)).toEqual({
      '@a': ['@c'],
      '@b': ['@a'],
      '@c': ['@b'],
    });
    expect(findDependents(doc, '@a')).toEqual(['@b']);
    expect(detectCycles(doc)).toEqual([['@a', '@c', '@b', '@a']]);
    expect(validateDocument(doc)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({code: 'circular-dependency'}),
      ]),
    );

    setMeasurementValue(doc, '@a', '1');
    resolveAll(doc);
    expect(detectCycles(doc)).toEqual([]);
    expect(doc.measurements['@c'].resolved).toBe(3);
  });

  it('moves one measurement by direction or index', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="@a" value="1"/><m name="@b" value="2"/><m name="@c" value="3"/><m name="@d" value="4"/></body-measurements></smis>',
      {includeCatalog: false},
    );

    moveMeasurement(doc, '@c', 'up');
    expect(doc.measurementOrder).toEqual(['@a', '@c', '@b', '@d']);

    moveMeasurement(doc, '@c', 'bottom');
    expect(doc.measurementOrder).toEqual(['@a', '@b', '@d', '@c']);

    moveMeasurement(doc, '@c', 1);
    expect(doc.measurementOrder).toEqual(['@a', '@c', '@b', '@d']);

    moveMeasurement(doc, '@c', 'top');
    expect(doc.measurementOrder).toEqual(['@c', '@a', '@b', '@d']);
  });

  it('moves multiple selected measurements as one block', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="@a" value="1"/><m name="@b" value="2"/><m name="@c" value="3"/><m name="@d" value="4"/><m name="@e" value="5"/></body-measurements></smis>',
      {includeCatalog: false},
    );

    moveMeasurements(doc, ['@b', '@d'], 3);
    expect(doc.measurementOrder).toEqual(['@a', '@c', '@e', '@b', '@d']);
  });

  it('adds a measurement after a target row', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="@a" value="1"/><m name="@c" value="3"/></body-measurements></smis>',
      {includeCatalog: false},
    );

    addMeasurementAfter(doc, '@a', '@b', '@a + 1');
    expect(doc.measurementOrder).toEqual(['@a', '@b', '@c']);
    expect(doc.measurements['@b'].resolved).toBe(2);
  });

  it('reorders measurements by dependencies and priority', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements>' +
        '<m name="@b" value="@a + 1"/>' + // Custom @b depends on @a
        '<m name="@a" value="10"/>' + // Custom @a
        '<m name="bust_circ" value="90"/>' + // Standard G04
        '<m name="height" value="170"/>' + // Standard A01
        '</body-measurements></smis>',
      {includeCatalog: false},
    );

    reorderByDependencies(doc);

    // Expected order:
    // 1. height (A01) - Standard, ID A01
    // 2. bust_circ (G04) - Standard, ID G04
    // 3. @a - Custom, no deps
    // 4. @b - Custom, depends on @a
    expect(doc.measurementOrder).toEqual(['height', 'bust_circ', '@a', '@b']);
  });

  it('clones and immutably updates document metadata and measurements', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal><given-name>Jane</given-name></personal><body-measurements><m name="@a" value="1"/></body-measurements></smis>',
      {includeCatalog: false},
    );

    const cloned = cloneDocument(doc);
    cloned.personal['given-name'] = 'Clone';
    expect(doc.personal['given-name']).toBe('Jane');

    const updated = updateDocument(doc, {
      notes: 'Edited',
      personal: {'given-name': 'Updated'},
      measurements: {
        '@a': {
          value: '2',
          fullName: 'A measurement',
          description: 'Edited row',
        },
      },
    });

    expect(updated).not.toBe(doc);
    expect(updated.notes).toBe('Edited');
    expect(updated.personal['given-name']).toBe('Updated');
    expect(updated.measurements['@a'].resolved).toBe(2);
    expect(updated.measurements['@a'].fullName).toBe('A measurement');
    expect(doc.measurements['@a'].resolved).toBe(1);
  });

  it('resolves measurement name conflicts directly', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="@custom" value="1"/><m name="@custom_1" value="2"/></body-measurements></smis>',
      {includeCatalog: false},
    );

    expect(resolveMeasurementNameConflict(doc, '@custom')).toEqual({
      requested: '@custom',
      resolved: '@custom_2',
      changed: true,
    });
    expect(resolveMeasurementNameConflict(doc, '@new')).toEqual({
      requested: '@new',
      resolved: '@new',
      changed: false,
    });
  });

  it('returns frontend-friendly individual measurement rows', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="height" value="100"/><m name="@half" value="height / 2" full_name="Half height" description="Derived"/></body-measurements></smis>',
      {includeCatalog: false},
    );

    expect(getMeasurementRows(doc)).toEqual([
      expect.objectContaining({
        index: 0,
        id: 'A01',
        name: 'height',
        label: 'Height: Total',
        raw: '100',
        value: 100,
        unit: 'cm',
        isResolved: true,
        isKnown: true,
        isCustom: false,
        dependencies: [],
        dependents: ['@half'],
        error: null,
      }),
      expect.objectContaining({
        index: 1,
        id: '',
        name: '@half',
        label: 'Half height',
        description: 'Derived',
        raw: 'height / 2',
        value: 50,
        unit: 'cm',
        isResolved: true,
        isKnown: false,
        isCustom: true,
        dependencies: ['height'],
        dependents: [],
        error: null,
      }),
    ]);
  });

  it('returns frontend-friendly multisize measurement rows', () => {
    const doc = parseSmis(
      '<smms><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><size>48</size><height>176</height><body-measurements><m name="G01" base="176" size_increase="0" height_increase="1" full_name="Height"/><m name="@custom" base="10" size_increase="1" height_increase="2"/></body-measurements></smms>',
    );

    expect(getMeasurementRows(doc)).toEqual([
      expect.objectContaining({
        index: 0,
        id: 'G01',
        name: 'G01',
        label: 'Height',
        raw: 'base=176; size_increase=0; height_increase=1',
        value: 176,
        unit: 'cm',
        isResolved: true,
        isKnown: true,
        isCustom: false,
      }),
      expect.objectContaining({
        index: 1,
        id: '',
        name: '@custom',
        label: '@custom',
        raw: 'base=10; size_increase=1; height_increase=2',
        value: 10,
        unit: 'cm',
        isResolved: true,
        isKnown: false,
        isCustom: true,
      }),
    ]);
  });

  it('marks unresolved and missing rows distinctly', () => {
    const doc = parseSmis(
      '<smis><version>0.3.4</version><unit>cm</unit><read-only>false</read-only><notes/><pm_system/><personal/><body-measurements><m name="@bad" value="@missing + 1"/><m name="@blank" value=""/></body-measurements></smis>',
      {includeCatalog: false},
    );

    expect(getMeasurementRows(doc)).toEqual([
      expect.objectContaining({
        name: '@bad',
        hasValue: true,
        isResolved: false,
        value: null,
        error: 'Unresolved dependency: @missing',
      }),
      expect.objectContaining({
        name: '@blank',
        hasValue: false,
        isResolved: false,
        value: null,
        error: null,
      }),
    ]);
  });
});

function mkdirTemp(): string {
  return mkdirSync(
    join(
      tmpdir(),
      `seamlyme-core-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ),
    {
      recursive: true,
    },
  );
}
