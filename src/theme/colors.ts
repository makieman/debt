/**
 * src/theme/colors.ts
 *
 * THE SINGLE SOURCE OF TRUTH for all colors in Duka Deni.
 *
 * Design principle: colours should have SEMANTIC names, not just visual ones.
 * Don't name a color "darkBlue" — name it "background.secondary".
 * This way, if you decide the secondary background should be dark green instead,
 * the name still makes sense and you only change it in one place.
 *
 * Usage in a component:
 *   import { colors } from '../theme';
 *   <View style={{ backgroundColor: colors.background.primary }} />
 *
 * Note: we keep both a theme object (for use in StyleSheet) AND rely on
 * these values being available in NativeWind via tailwind.config.js
 * (you can extend the Tailwind theme with these values in a later day).
 */

export const colors = {
  // ── Backgrounds ─────────────────────────────────────────────────────────────
  // primary is the main floor (pure white #FFFFFF)
  // secondary is slightly darker (soft gray #F8FAFC) for cards and inputs
  // tertiary is for borders, dividers, subtle separators (#E5E7EB)
  background: {
    primary: "#FFFFFF",
    secondary: "#F8FAFC",
    tertiary: "#E5E7EB",
  },

  // ── Accent ──────────────────────────────────────────────────────────────────
  // Emerald green is our primary action and positive accent color
  accent: {
    teal: "#10B981",       // primary green action
    tealDim: "#10B98115",  // green at ~8% opacity for subtle backgrounds
  },

  // ── Text ────────────────────────────────────────────────────────────────────
  // Three levels of text weight and contrast
  text: {
    primary: "#111827",    // dark gray for high readability
    secondary: "#6B7280",  // muted gray for labels, phone numbers, subtitles
    muted: "#9CA3AF",      // placeholders, hints, disabled states
  },

  // ── Semantic: Financial States ───────────────────────────────────────────────
  debt: "#EF4444",         // soft red - customer owes money
  payment: "#10B981",      // emerald green - money received / settled

  // ── Utilities ───────────────────────────────────────────────────────────────
  white: "#FFFFFF",
} as const;
//    ^^^^^^^^ "as const" makes every value a literal type, not just "string".
//    This means TypeScript will error if you misspell a color name anywhere.

// Export the type so you can type function parameters that accept a color value
export type Colors = typeof colors;
