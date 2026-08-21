/**
 * src/components/AddCustomerModal.tsx
 *
 * A bottom-sheet style modal for adding a new customer.
 *
 * ─── FIXES (Aug 2026) ────────────────────────────────────────────────────────
 *
 * FIX 1 — KEYBOARD COVERING INPUTS (Android):
 * On Android, Expo sets windowSoftInputMode to "adjustResize" by default.
 * This means the OS already shrinks the window height when the keyboard opens.
 * Using KeyboardAvoidingView with behavior="height" on top of that causes a
 * DOUBLE SHRINK — the system shrinks AND our KAV shrinks, pushing the bottom
 * sheet content further down out of view.
 * Solution: Don't pass a behavior prop on Android (let the OS handle it alone).
 * On iOS: the window doesn't resize, so we still need behavior="padding".
 *
 * FIX 2 — FLASH/FLICKER ON MODAL CLOSE:
 * Previously, handleSave called resetForm() + onSuccess() + onClose()
 * synchronously. The modal slide-out animation was still playing while the
 * parent re-rendered its customer list. This caused a visible flash behind
 * the still-animating modal.
 * Solution: Call onClose() first, then delay onSuccess() by ~350 ms so the
 * modal is fully hidden before the parent re-renders.
 *
 * ─── FEATURE: IMPORT FROM CONTACTS ──────────────────────────────────────────
 *
 * A "Import from Contacts" button opens the native system contact picker via
 * expo-contacts/legacy presentContactPickerAsync(). When a contact is chosen,
 * the name and phone fields are auto-filled. The user can then review and save.
 *
 * REQUIRES: expo-contacts package + android.permission.READ_CONTACTS in app.json
 * NOTE: Needs a development build — contact picker does not work in Expo Go.
 *
 * ─── ORIGINAL CONCEPTS ───────────────────────────────────────────────────────
 *
 * MODAL vs WEB DIALOG:
 * In React Native, Modal renders in a SEPARATE NATIVE WINDOW LAYER above the
 * app — not just z-index. The modal content is isolated from the app's view
 * hierarchy.
 *
 * CONTROLLED INPUTS:
 * React Native TextInput has no internal state. Always use:
 *   value={stateName}
 *   onChangeText={setStateName}
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
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Contacts from "expo-contacts/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useThemeContext, Colors } from "../theme";
import { useLanguage } from "../store/LanguageContext";
import { addCustomer } from "../repositories/customers";
import { db } from "../db";

import { ImportContactsModal } from "./ImportContactsModal";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddCustomerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void; // called after a customer is saved — parent uses this to refresh list
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddCustomerModal({ visible, onClose, onSuccess }: AddCustomerModalProps) {
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const styles = makeStyles(colors);

  // ── Controlled input state ────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  // ── Ref for auto-focus ────────────────────────────────────────────────────
  const nameInputRef = useRef<TextInput>(null);

  // ── Auto-focus when modal becomes visible ─────────────────────────────────
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setName("");
      setPhone("");
      setNameError("");
      setSaving(false);
      setImportModalVisible(false);
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
  };

  // ── Open Import Contacts Modal ────────────────────────────────────────────
  const handleOpenImportModal = () => {
    setImportModalVisible(true);
  };


  // ── Validation + save ────────────────────────────────────────────────────
  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError(t("enterCustomerNameError"));
      return;
    }

    try {
      setSaving(true);
      await addCustomer(db, {
        name: trimmedName,
        phone: phone.trim() || undefined,
      });

      onClose();

      setTimeout(() => {
        onSuccess();
      }, 350);
    } catch (error) {
      setNameError(t("failedToSaveError"));
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kavWrapper}
      >
        <View style={styles.sheet}>

          {/* ── Drag handle ───────────────────────────────────────────────── */}
          <View style={styles.dragHandle} />

          {/* ── Title ─────────────────────────────────────────────────────── */}
          <Text style={styles.title}>{t("newCustomer")}</Text>

          {/* ── Import from Contacts button ───────────────────────────────── */}
          <Pressable
            onPress={handleOpenImportModal}
            disabled={saving}
            style={({ pressed }) => [
              styles.importButton,
              pressed && styles.importButtonPressed,
              saving && styles.importButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("importFromContacts")}
          >
            <Ionicons name="people-outline" size={18} color={colors.accent.teal} />
            <Text style={styles.importButtonText}>
              {t("importFromContacts")}
            </Text>
          </Pressable>

          {/* ── Name input ────────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("nameRequired")}</Text>
            <TextInput
              ref={nameInputRef}
              style={[styles.input, nameError ? styles.inputError : null]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError("");
              }}
              placeholder={t("placeholderName")}
              placeholderTextColor={colors.text.muted}
              returnKeyType="next"
              maxLength={80}
              editable={!saving}
            />
            {nameError ? (
              <Text style={styles.errorText}>{nameError}</Text>
            ) : null}
          </View>

          {/* ── Phone input ───────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("phoneOptional")}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t("placeholderPhone")}
              placeholderTextColor={colors.text.muted}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              maxLength={20}
              editable={!saving}
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
              {saving ? t("saving") : t("saveCustomer")}
            </Text>
          </Pressable>

          {/* ── Cancel link ───────────────────────────────────────────────── */}
          <Pressable onPress={handleClose} style={styles.cancelButton} disabled={saving}>
            <Text style={styles.cancelText}>{t("cancel")}</Text>
          </Pressable>

        </View>
      </KeyboardAvoidingView>

      <ImportContactsModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onSuccess={() => {
          setImportModalVisible(false);
          onClose();
          setTimeout(() => {
            onSuccess();
          }, 350);
        }}
      />
    </Modal>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
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
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.background.tertiary,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.accent.teal + "60",
    backgroundColor: colors.accent.teal + "10",
  },
  importButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  importButtonDisabled: {
    opacity: 0.4,
  },
  importButtonText: {
    color: colors.accent.teal,
    fontSize: 14,
    fontWeight: "600",
  },
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
