/** @type {import('prettier').Config} */
module.exports = {
  // Core formatting
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,

  // Bracket handling
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",

  // End of line
  endOfLine: "lf",

  // File-specific overrides
  overrides: [
    {
      files: ["*.json", "*.jsonc"],
      options: {
        printWidth: 200,
        singleQuote: false,
      },
    },
    {
      files: ["*.md", "*.mdx"],
      options: {
        proseWrap: "always",
        printWidth: 80,
      },
    },
    {
      files: ["*.yaml", "*.yml"],
      options: {
        singleQuote: false,
        proseWrap: "preserve",
      },
    },
  ],

  // Tailwind CSS plugin (sorts class names)
  plugins: ["prettier-plugin-tailwindcss"],
};
