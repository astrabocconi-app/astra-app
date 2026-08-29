/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  // Driven by the hidden inverted mode (lib/egg-store.ts), not by the OS
  // setting — the app has one look until someone finds the egg.
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ASTRA brand palette. `primary` is sampled from the logo (#04107E).
        // Swap in exact brand-guide hexes when available to fine-tune.
        astra: {
          primary: "#04107E", // brand deep blue (from logo)
          dark: "#020A52", // darker shade (pressed states, headers)
          accent: "#3B4AD0", // lighter brand blue (highlights, links)
          light: "#EDEFF9", // very light tint (surfaces, selected bg)
        },
      },
    },
  },
  plugins: [],
};
