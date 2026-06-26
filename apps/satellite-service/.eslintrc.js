module.exports = {
  root: true,
  extends: ['@zenith/eslint-config'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  ignorePatterns: ['src/__tests__/**/*', '**/*.test.ts', '**/*.spec.ts'],
};
