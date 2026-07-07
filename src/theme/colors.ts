/**
 * src/theme/colors.ts
 *
 * THE SINGLE SOURCE OF TRUTH for all colors in Duka Deni.
 */

export const lightColors = {
  background: {
    primary: "#FFFFFF",
    secondary: "#F8FAFC",
    tertiary: "#E5E7EB",
  },
  accent: {
    teal: "#10B981",
    tealDim: "#10B98115",
  },
  text: {
    primary: "#111827",
    secondary: "#6B7280",
    muted: "#9CA3AF",
  },
  debt: "#EF4444",
  payment: "#10B981",
  white: "#FFFFFF",
} as const;

export const darkColors = {
  background: {
    primary: "#111827",
    secondary: "#1F2937",
    tertiary: "#374151",
  },
  accent: {
    teal: "#10B981",
    tealDim: "#10B98125",
  },
  text: {
    primary: "#F9FAFB",
    secondary: "#D1D5DB",
    muted: "#9CA3AF",
  },
  debt: "#EF4444",
  payment: "#10B981",
  white: "#FFFFFF",
} as const;

// Fallback for files not yet migrated to useThemeContext
export const colors = darkColors;

export type Colors = typeof lightColors | typeof darkColors;
