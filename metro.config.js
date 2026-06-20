/**
 * metro.config.js
 *
 * Metro is the JavaScript bundler that Expo uses (like webpack, but for
 * React Native). NativeWind v4 requires a Metro plugin so that:
 *   1. `global.css` is processed by PostCSS / Tailwind at bundle time
 *   2. The generated style sheet is injected into the JS bundle
 *
 * Without this config, importing global.css in App.tsx would either
 * throw an error ("unknown file type") or silently do nothing.
 *
 * We wrap Expo's default Metro config so we don't lose any Expo-specific
 * bundler settings — NativeWind just adds its transformer on top.
 */
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
