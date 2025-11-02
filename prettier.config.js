/**
 * @type {import("prettier").Config}
 */
const config = {
  semi: true,
  trailingComma: "es5",
  singleQuote: false,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  arrowParens: "always",
  endOfLine: "lf",
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  importOrder: [
    "^node:",
    "<BUILTIN_MODULES>",
    "",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@stepkit/(.*)$",
    "",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "decorators-legacy"],
  importOrderTypeScriptVersion: "5.0.0",
  overrides: [
    {
      files: ["*.js", "*.json", "*.ts", "*.yml", "*.yaml"],
      options: {},
    },
  ],
};

export default config;
