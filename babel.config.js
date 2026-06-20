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
 * Plugin order matters: "nativewind/babel" must come BEFORE "react-native-reanimated/plugin"
 * if you ever add Reanimated. For now it just needs to be in the plugins array.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: ["nativewind/babel"],
  };
};
