# SeamlyME Core

## Installation

```sh
npm install
npm run build
npm test
```

## Quickstart: CLI

Validate a measurement file:

```sh
npm run cli -- validate ../example_measurements.smis
```

Print resolved measurements in file order:

```sh
npm run cli -- validate ../example_measurements.smis --list --no-catalog
```

Print JSON:

```sh
npm run cli -- validate ../example_measurements.smis --json
```

## Quickstart: Print out measurements value

```ts
import {
  listAll,
  loadMeasurementFile,
  validateDocument,
} from '@seamlyme/core';

const { document, warnings } = loadMeasurementFile('/path/to/person.smis');

for (const warning of warnings) {
  console.warn(`Warning: ${warning.message}`);
}

const issues = validateDocument(document);
for (const issue of issues) {
  console.log(`${issue.severity}: ${issue.code}: ${issue.message}`);
}

for (const measurement of listAll(document)) {
  if ('resolved' in measurement) {
    const id = measurement.id ? `[${measurement.id}] ` : '';
    const value = measurement.resolved ?? '-';
    console.log(`${id}${measurement.name}: ${value} ${document.unit}`);
  } else {
    console.log(
      `${measurement.name}: base=${measurement.base}, size_increase=${measurement.sizeIncrement}, height_increase=${measurement.heightIncrement}`,
    );
  }
}
```

## License

BSD 3-Clause Clear. See [LICENSE](./LICENSE).
