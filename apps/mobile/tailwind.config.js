/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // TODO(scaffold): replace with the real ASTRA palette (flagged to owner).
        astra: {
          primary: "#1a1a2e", // PLACEHOLDER
          accent: "#e94560", // PLACEHOLDER
        },
      },
    },
  },
  plugins: [],
};
