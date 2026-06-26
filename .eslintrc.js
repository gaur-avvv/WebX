// @ts-check
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      extends: ['@zenith/eslint-config/next'],
      parserOptions: {
        project: ['apps/web/tsconfig.json'],
      },
    },
    {
      files: ['apps/satellite-service/**/*.ts'],
      extends: ['@zenith/eslint-config'],
      parserOptions: {
        project: ['apps/satellite-service/tsconfig.json'],
      },
    },
    {
      files: ['packages/**/*.{ts,js}'],
      extends: ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    '*.config.js',
    '*.config.mjs',
    '*.config.ts',
  ],
};
