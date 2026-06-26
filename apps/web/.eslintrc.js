module.exports = {
  root: true,
  extends: ['@zenith/eslint-config/next'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
};
