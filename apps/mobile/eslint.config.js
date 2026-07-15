import astra from "@astra/config/eslint";

export default [
  ...astra,
  {
    // Expo/React Native globals & JSX are handled by the base config.
    // Add RN-specific overrides here as the app grows.
  },
];
