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
  // Three layers of depth create visual hierarchy without needing shadows.
  // primary is the darkest: the "floor" everything sits on.
  // secondary is slightly lighter: cards, modals, input fields.
  // tertiary is the lightest dark shade: borders and dividers.
  background: {
    primary: "#0F1117",    // deep slate — main app background
    secondary: "#1A1D27",  // slightly lighter — cards, sheets
    tertiary: "#22263A",   // borders, dividers, subtle separators
  },

  // ── Accent ──────────────────────────────────────────────────────────────────
  // Teal is our only action color. One accent = clear hierarchy of interaction.
  accent: {
    teal: "#00C896",       // primary action: buttons, highlights, initials circle
    tealDim: "#00C89620",  // teal at 12.5% opacity — subtle background tints
  },

  // ── Text ────────────────────────────────────────────────────────────────────
  // Three levels of text weight create visual hierarchy without size changes.
  text: {
    primary: "#F0F2FF",    // main readable text — high contrast on dark bg
    secondary: "#8A90B4",  // labels, phone numbers, subtitles
    muted: "#4A5080",      // placeholders, hints, disabled states
  },

  // ── Semantic: Financial States ───────────────────────────────────────────────
  // These are the most important colors in a debt app — they convey
  // financial meaning at a glance. Red = money owed. Green = settled/received.
  debt: "#FF6B6B",         // warm red — customer owes shop money
  payment: "#00C896",      // same teal as accent — money received / settled

  // ── Utilities ───────────────────────────────────────────────────────────────
  white: "#FFFFFF",
} as const;
//    ^^^^^^^^ "as const" makes every value a literal type, not just "string".
//    This means TypeScript will error if you misspell a color name anywhere.

// Export the type so you can type function parameters that accept a color value
export type Colors = typeof colors;
