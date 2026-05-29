import {SEAMLY_MEASUREMENT_CATALOG} from '../src/core/catalog.js';

export interface GeneratorOptions {
  type?: 'individual' | 'multisize';
  complexity?: 'empty' | 'some' | 'full' | 'errors';
  seed?: string;
}

/**
 * Generates a random or semi-structured SMIS/SMMS XML string for testing.
 */
export function generateSmisXml(options: GeneratorOptions = {}): string {
  const {type = 'individual', complexity = 'some'} = options;
  const root = type === 'multisize' ? 'smms' : 'smis';

  let content = `<?xml version="1.0" encoding="UTF-8"?>\n<${root}>\n`;
  content += '  <version>0.3.4</version>\n';
  content += '  <unit>cm</unit>\n';
  content += '  <read-only>false</read-only>\n';
  content += `  <notes>Generated for testing (${complexity})</notes>\n`;

  if (type === 'individual') {
    content += '  <pm_system>998</pm_system>\n';
    content += '  <personal>\n';
    content += '    <given-name>Test</given-name>\n';
    content += '    <family-name>User</family-name>\n';
    content += '  </personal>\n';
  } else {
    content += '  <size>48</size>\n';
    content += '  <height>176</height>\n';
  }

  content += '  <body-measurements>\n';

  const measurements = getMeasurementsForComplexity(complexity);
  for (const m of measurements) {
    if (type === 'individual') {
      content += `    <m name="${m.name}" value="${m.value}"${m.fullName ? ` full_name="${m.fullName}"` : ''}/>\n`;
    } else {
      content += `    <m name="${m.name}" base="${m.value}" size_increase="${m.sizeInc ?? 0}" height_increase="${m.heightInc ?? 0}"${m.fullName ? ` full_name="${m.fullName}"` : ''}/>\n`;
    }
  }

  content += `  </body-measurements>\n</${root}>\n`;

  return content;
}

interface GeneratedMeasurement {
  name: string;
  fullName?: string;
  value: string | number;
  sizeInc?: string;
  heightInc?: string;
}

function getMeasurementsForComplexity(complexity: string) {
  const list: GeneratedMeasurement[] = [];

  if (complexity === 'empty') return list;

  if (complexity === 'full' || complexity === 'some') {
    const count = complexity === 'full' ? 20 : 5;
    const shuffled = [...SEAMLY_MEASUREMENT_CATALOG].sort(
      () => 0.5 - Math.random(),
    );
    const selected = shuffled.slice(0, count);

    for (const m of selected) {
      list.push({
        name: m.name,
        fullName: m.fullName,
        value: (Math.random() * 50 + 10).toFixed(1),
        sizeInc: (Math.random() * 2).toFixed(1),
        heightInc: (Math.random() * 2).toFixed(1),
      });
    }

    if (complexity === 'full') {
      // Add some formulas
      list.push({
        name: '@derived',
        value: `${selected[0].name} + ${selected[1].name}`,
        fullName: 'Derived Measurement',
      });
    }
  }

  if (complexity === 'errors') {
    list.push({name: '@missing', value: '@nonexistent + 10'});
    list.push({name: '@circular_a', value: '@circular_b + 1'});
    list.push({name: '@circular_b', value: '@circular_a + 1'});
    list.push({name: '@bad_syntax', value: '10 ++ 20'});
  }

  return list;
}

/**
 * Generates a full body measurement file with realistic values.
 */
export function generateFullBodySmis(): string {
  const measurements = [
    {name: 'height', value: 160},
    {name: 'bust_circ', value: 88},
    {name: 'waist_circ', value: 68},
    {name: 'hip_circ', value: 94},
    {name: 'shoulder_length', value: 11.5},
    {name: 'arm_shoulder_tip_to_wrist_bent', value: 58},
    {name: 'leg_waist_side_to_floor', value: 100},
    {name: 'neck_circ', value: 34},
  ];

  let content = '<?xml version="1.0" encoding="UTF-8"?>\n<smis>\n';
  content +=
    '  <version>0.3.4</version>\n  <unit>cm</unit>\n  <read-only>false</read-only>\n  <notes>Full body 160cm</notes>\n';
  content +=
    '  <pm_system>998</pm_system>\n  <personal><given-name>Full</given-name><family-name>Body</family-name></personal>\n';
  content += '  <body-measurements>\n';

  for (const m of measurements) {
    content += `    <m name="${m.name}" value="${m.value}"/>\n`;
  }

  content +=
    '    <m name="@waist_to_hip" value="hip_circ - waist_circ" full_name="Waist to Hip Difference"/>\n';
  content +=
    '    <m name="@total_arm" value="shoulder_length + arm_shoulder_tip_to_wrist_bent" full_name="Total Arm Length"/>\n';
  content += '  </body-measurements>\n</smis>\n';

  return content;
}
