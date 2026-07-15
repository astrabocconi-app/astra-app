// Shared Prettier config for the ASTRA monorepo.
// Consume from a package's own prettier.config.js:
//
//   export { default } from "@astra/config/prettier";
//
/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: false,
  trailingComma: "es5",
  printWidth: 100,
  tabWidth: 2,
};
