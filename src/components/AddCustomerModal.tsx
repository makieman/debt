/**
 * src/components/AddCustomerModal.tsx
 *
 * A bottom-sheet style modal for adding a new customer.
 * Uses React Native's built-in Modal — no third-party library needed for Day 2.
 *
 * ─── CONCEPTS ────────────────────────────────────────────────────────────────
 *
 * MODAL vs WEB DIALOG:
 * On the web, <dialog> is an HTML element that uses z-index stacking.
 * In React Native, Modal renders in a SEPARATE NATIVE WINDOW LAYER above
 * the app — not just z-index. The modal content is isolated from the app's
 * view hierarchy. This is why you can't accidentally click "through" it.
 *
 * KEYBOARDAVOIDINGVIEW:
 * When the soft keyboard appears, it covers part of the screen.
 * On iOS: the window doesn't resize — we add padding (behavior="padding")
 *   so content shifts up above the keyboard.
 * On Android: the window IS resized by the system already — we shrink
 *   the container height (behavior="height") instead of adding padding,
 *   otherwise content shifts TWICE (system + our code = double shift).
 *
 * CONTROLLED INPUTS:
 * React Native TextInput has no internal state. If you don't pass value=,
 * the displayed text and your React state can diverge — the user clears the
 * input but your state still has the old value (or vice versa). Always use:
 *   value={stateName}
 *   onChangeText={setStateName}
 * This is called a "controlled input" — React controls the value, not the DOM.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { colors } from "../theme";
import { addCustomer } from "../repositories/customers";
import { db } from "../db";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddCustomerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void; // called after a customer is saved — parent uses this to refresh list
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddCustomerModal({ visible, onClose, onSuccess }: AddCustomerModalProps) {
  // ── Controlled input state ────────────────────────────────────────────────
  // Both inputs are controlled: value is always driven by state, never by the
  // TextInput's internal text. This is required in React Native.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Ref for auto-focus ────────────────────────────────────────────────────
  // We need a ref to imperatively call .focus() on the name input when the
  // modal opens. We can't use the autoFocus prop because the Modal's animation
  // hasn't finished when the component first mounts — focus would fire before
  // the keyboard animation completes, causing a visual glitch.
  const nameInputRef = useRef<TextInput>(null);

  // ── Auto-focus when modal becomes visible ─────────────────────────────────
  useEffect(() => {
    if (visible) {
      // Small delay to let the slide-up animation complete before showing keyboard
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // ── Reset form when closed ───────────────────────────────────────────────
  // Without this, re-opening the modal would show the previous entry's text.
  const resetForm = () => {
    setName("");
    setPhone("");
    setNameError("");
    setSaving(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // ── Validation + save ────────────────────────────────────────────────────
  const handleSave = async () => {
    // Trim whitespace before validation — "   " should not be a valid name
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError("Please enter a customer name");
      return;
    }

    try {
      setSaving(true);
      await addCustomer(db, {
        name: trimmedName,
        phone: phone.trim() || undefined, // empty string → undefined → stored as null
      });
      resetForm();
      onSuccess(); // tell the parent to refresh the customer list
      onClose();
    } catch (error) {
      setNameError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent            // the backdrop behind the sheet is semi-transparent
      animationType="slide"  // sheet slides up from the bottom
      onRequestClose={handleClose} // Android back button dismisses modal
    >
      {/* ── Backdrop: tap to dismiss ──────────────────────────────────────── */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/*
        ── KeyboardAvoidingView ────────────────────────────────────────────────
        behavior differs per platform:
          iOS     → "padding": add bottom padding equal to keyboard height
          Android → "height": shrink the view height to exclude keyboard area
                    (Android already resizes the window; adding padding doubles it)
      */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kavWrapper}
      >
        <View style={styles.sheet}>

          {/* ── Drag handle (visual only) ─────────────────────────────────── */}
          <View style={styles.dragHandle} />

          {/* ── Title ─────────────────────────────────────────────────────── */}
          <Text style={styles.title}>New Customer</Text>

          {/* ── Name input ────────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              ref={nameInputRef}
              style={[styles.input, nameError ? styles.inputError : null]}
              value={name}                        // ← controlled: value from state
              onChangeText={(text) => {           // ← controlled: state update on type
                setName(text);
                if (nameError) setNameError("");  // clear error as user types
              }}
              placeholder="e.g. Kamau Wanjiku"
              placeholderTextColor={colors.text.muted}
              returnKeyType="next"                // shows "Next" on keyboard instead of "Return"
              maxLength={80}
            />
            {nameError ? (
              <Text style={styles.errorText}>{nameError}</Text>
            ) : null}
          </View>

          {/* ── Phone input ───────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 0712 345 678"
              placeholderTextColor={colors.text.muted}
              keyboardType="phone-pad"           // numeric keyboard on mobile
              returnKeyType="done"
              onSubmitEditing={handleSave}       // pressing Done on keyboard = Save
              maxLength={20}
            />
          </View>

          {/* ── Save button ───────────────────────────────────────────────── */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
              saving && styles.saveButtonDisabled,
            ]}
          >
            <Text style={styles.saveButtonText}>
              {saving ? "Saving..." : "Save Customer"}
            </Text>
          </Pressable>

          {/* ── Cancel link ───────────────────────────────────────────────── */}
          <Pressable onPress={handleClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Modal structure ────────────────────────────────────────────────────────
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  kavWrapper: {
    flex: 1,
    // This positions the sheet at the bottom of the screen.
    // justifyContent: "flex-end" pushes children to the bottom.
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.background.tertiary,
    padding: 24,
    paddingBottom: 40,   // extra space at bottom for home bar on iPhone
    gap: 16,
  },

  // ── Drag handle ──────────────────────────────────────────────────────────
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },

  // ── Header ───────────────────────────────────────────────────────────────
  title: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },

  // ── Form fields ───────────────────────────────────────────────────────────
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text.primary,
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.debt,
  },
  errorText: {
    color: colors.debt,
    fontSize: 13,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  saveButton: {
    backgroundColor: colors.accent.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: 15,
  },
});
