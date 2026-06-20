/**
 * src/components/EmptyState.tsx
 *
 * Shown in the customer list when there are no customers yet.
 *
 * UX PURPOSE:
 * An empty list with no message is confusing — the user doesn't know
 * if the app is broken, still loading, or genuinely empty. An empty state
 * tells them: "You're in the right place, and here's your first action."
 *
 * This is especially important for new-user retention — users who see a
 * blank screen without guidance often uninstall within the first minute.
 * A good empty state turns confusion into confidence.
 *
 * IMPLEMENTATION NOTE — Pure React Native (no SVG library):
 * We build the person icon purely from View components with borderRadius.
 * A circle = View with borderRadius equal to half its width/height.
 * This avoids any third-party dependency.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

// ─── Person Icon (pure RN views) ─────────────────────────────────────────────
// Head: a circle (square View with borderRadius = width/2)
// Body: a wider, shorter rounded rectangle suggesting shoulders/torso
// Outer ring: a large circle framing both shapes

function PersonIcon() {
  return (
    <View style={iconStyles.outerRing}>
      {/* Head */}
      <View style={iconStyles.head} />
      {/* Body / shoulders */}
      <View style={iconStyles.body} />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  outerRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.background.tertiary,
    alignItems: "center",
    justifyContent: "flex-end",    // push body to bottom of circle
    overflow: "hidden",            // clip body that extends beyond circle
    paddingTop: 18,
  },
  head: {
    width: 34,
    height: 34,
    borderRadius: 17,              // circle: borderRadius = width / 2
    backgroundColor: colors.background.tertiary,
    position: "absolute",
    top: 16,
  },
  body: {
    width: 60,
    height: 36,
    borderTopLeftRadius: 30,       // rounded top corners create a shoulder arc
    borderTopRightRadius: 30,
    backgroundColor: colors.background.tertiary,
    marginBottom: -2,              // slight overlap with ring border
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

export function EmptyState() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <PersonIcon />
      </View>

      <Text style={styles.title}>No customers yet</Text>

      <Text style={styles.subtitle}>
        Tap the{" "}
        <Text style={styles.plusHighlight}>+</Text>
        {" "}button to add your{"\n"}first customer
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
    gap: 16,
  },
  iconWrapper: {
    marginBottom: 8,
    opacity: 0.8,
  },
  title: {
    color: colors.text.secondary,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  plusHighlight: {
    color: colors.accent.teal,
    fontWeight: "700",
    fontSize: 17,
  },
});
