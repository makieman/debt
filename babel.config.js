/**
 * babel.config.js
 *
 * Babel is the JavaScript transpiler Expo uses to convert modern JS/TS
 * into code that runs on the JavaScript engine inside React Native.
 *
 * We need to add NativeWind's babel plugin here so that when Babel sees:
 *   <Text className="text-red-500">Hello</Text>
 *
 * ...it transforms it to:
 *   <Text style={[{color: '#ef4444'}]}>Hello</Text>
 *
 * That transformation happens at compile time (build time), not at runtime.
 * This is why NativeWind has zero runtime overhead for class name resolution.
 *
 * Plugin order matters:
 *   1. "nativewind/babel"              — className → StyleSheet transformation
 *   2. "react-native-reanimated/plugin" — MUST be LAST
 *      Required by victory-native v41 (which uses Reanimated for animations)
 *      and also by React Native Reanimated itself. Reanimated's babel plugin
 *      transforms worklet functions so they can run on the native thread.
 *      If it's not last, it may conflict with other plugins.
 */
module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin", // MUST be last — transforms Reanimated worklets
    ],
  };
};

