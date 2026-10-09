// Metro config for the monorepo + NativeWind.
// Watches the repo root so workspace packages (@astra/shared) resolve.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// With a Sentry auth token (EAS secret SENTRY_AUTH_TOKEN) Metro also injects
// debug IDs so uploaded source maps match; without one this is the plain Expo
// config (see the matching gate in app.config.ts).
const config = process.env.SENTRY_AUTH_TOKEN
  ? require("@sentry/react-native/metro").getSentryExpoConfig(projectRoot)
  : getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = withNativeWind(config, { input: "./global.css" });
