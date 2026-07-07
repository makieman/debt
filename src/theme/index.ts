/**
 * src/theme/index.ts
 *
 * Barrel export for the theme module.
 *
 * Instead of:
 *   import { colors } from '../theme/colors';
 *
 * Every component can now write:
 *   import { colors } from '../theme';
 *
 * This is called a "barrel" export — index.ts re-exports everything from
 * the folder. It's a common pattern in TypeScript projects to keep import
 * paths clean and refactoring easy (if you move colors.ts, you only update
 * this file, not every component that uses colors).
 */

export { lightColors, darkColors, colors } from "./colors";
export type { Colors } from "./colors";
export { ThemeProvider, useThemeContext } from "./ThemeContext";
