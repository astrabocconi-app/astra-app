import astra from "@astra/config/eslint";

export default [
  ...astra,
  {
    // Route handlers under app/api are server-only; nothing here should import
    // client React. Keep this file as the place to enforce that boundary as the
    // API grows. See docs/ARCHITECTURE.md.
  },
];
