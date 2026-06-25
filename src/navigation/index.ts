/**
 * src/navigation/index.ts
 *
 * Barrel export for the navigation module.
 *
 * ─── THE BARREL EXPORT PATTERN ───────────────────────────────────────────────
 *
 * A "barrel" is an index.ts that re-exports from the files in its directory.
 * Any folder with an index.ts can be imported by folder name:
 *
 *   // Without barrel — must know internal file structure:
 *   import RootTabs from './navigation/RootTabs'
 *   import { CustomerListNavProp } from './navigation/types'
 *
 *   // With barrel — one import, folder is the public API:
 *   import RootTabs, { CustomerListNavProp } from './navigation'
 *
 * Benefits:
 *   1. Consumers don't need to know internal file layout
 *   2. If you rename RootTabs.tsx → AppNavigator.tsx, only this file changes
 *   3. Imports are shorter and more readable
 *
 * The `export * from` syntax re-exports all named exports from a module.
 * The `export { default as X }` syntax re-exports a default export as a named one.
 */

export { default as RootTabs } from './RootTabs';
export { default as CustomersStack } from './CustomersStack';
export * from './types';
