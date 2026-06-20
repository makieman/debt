/** @type {import('tailwindcss').Config} */
module.exports = {
  // ─── Content ────────────────────────────────────────────────────────────────
  // Tailwind scans these files at build time, looking for class names.
  // It only generates CSS for classes it actually finds — this is called
  // "purging" and keeps the output small.
  //
  // Rule of thumb: if you write className="..." in a file, that file's
  // path must be covered by one of these globs.
  content: [
    "./App.tsx",
    "./src/**/*.{ts,tsx}",
  ],

  // ─── Presets ────────────────────────────────────────────────────────────────
  // NativeWind v4 requires its own preset to bridge Tailwind's web-focused
  // defaults to React Native's box model (no CSS cascade, no rem units, etc.)
  presets: [require("nativewind/preset")],

  theme: {
    extend: {},
  },

  plugins: [],
};
