let customConfig = [];
let hasIgnoresFile = false;
try {
  require.resolve('./eslint.ignores.cjs');
  hasIgnoresFile = true;
} catch {
  // eslint.ignores.cjs doesn't exist
}

if (hasIgnoresFile) {
  const ignores = require('./eslint.ignores.cjs');
  customConfig = [{ignores}];
}

const gtsConfig = require('gts').map(config => {
  if (config.languageOptions?.parserOptions?.project === './tsconfig.json') {
    return {
      ...config,
      languageOptions: {
        ...config.languageOptions,
        parserOptions: {
          ...config.languageOptions.parserOptions,
          project: './tsconfig.eslint.json',
        },
      },
    };
  }
  return config;
});

module.exports = [...customConfig, ...gtsConfig];
