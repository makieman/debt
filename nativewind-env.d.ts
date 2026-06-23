/// <reference types="nativewind/types" />

// CSS files are imported as side effects for NativeWind only.
// They have no JS exports — this declaration tells TypeScript that's expected.
declare module "*.css" {}
