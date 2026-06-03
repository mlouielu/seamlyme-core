import packageJson from '../../package.json' with {type: 'json'};

/**
 * SeamlyMe format version components.
 */
export const VERSION_MAJOR = 0;
export const VERSION_MINOR = 3;
export const VERSION_PATCH = 4;

/**
 * SeamlyMe format current version string.
 */
export const SEAMLYME_FORMAT_VERSION = `${VERSION_MAJOR}.${VERSION_MINOR}.${VERSION_PATCH}`;

/**
 * SeamlyMe-core package version.
 */
export const SEAMLYME_CORE_VERSION = packageJson.version;
