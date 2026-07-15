import Constants from "expo-constants";

// Runtime config resolved from app.config.ts `extra`.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
  appEnv?: string;
};

export const API_URL = extra.apiUrl ?? "http://localhost:3000";
export const APP_ENV = extra.appEnv ?? "development";
