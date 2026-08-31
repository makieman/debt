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
 * A "Import from Contacts" button opens the ImportContactsModal (multi-select).
 * When contacts are imported, the modal closes and the parent list refreshes.
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
  ActivityIndicator,
} from "react-native";
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
  const phoneInputRef = useRef<TextInput>(null);

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
      nameInputRef.current?.focus();
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

  const canSave = name.trim().length > 0 && !saving;

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

          {/* ── Header row (title + close X) ──────────────────────────────── */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>{t("newCustomer")}</Text>
              <Text style={styles.subtitle}>Fill in the details below</Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <View style={styles.divider} />

          {/* ── Import from Contacts — card style ─────────────────────────── */}
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
            <View style={styles.importIconWrap}>
              <Ionicons name="people" size={22} color={colors.accent.teal} />
            </View>
            <View style={styles.importTextBlock}>
              <Text style={styles.importButtonTitle}>{t("importFromContacts")}</Text>
              <Text style={styles.importButtonSub}>Pick one or more from your phone book</Text>
            </View>
          </Pressable>

          {/* ── OR divider ────────────────────────────────────────────────── */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR ADD MANUALLY</Text>
            <View style={styles.orLine} />
          </View>

          {/* ── Name input ────────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("nameRequired")}</Text>
            <View style={[styles.inputWrap, nameError ? styles.inputWrapError : null]}>
              <Ionicons
                name="person-outline"
                size={18}
                color={nameError ? colors.debt : colors.text.muted}
                style={styles.inputIcon}
              />
              <TextInput
                ref={nameInputRef}
                style={styles.input}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError("");
                }}
                placeholder={t("placeholderName")}
                placeholderTextColor={colors.text.muted}
                returnKeyType="next"
                onSubmitEditing={() => phoneInputRef.current?.focus()}
                maxLength={80}
                editable={!saving}
              />
              {name.length > 0 && !saving && (
                <Pressable onPress={() => setName("")} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={16} color={colors.text.muted} />
                </Pressable>
              )}
            </View>
            {nameError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.debt} />
                <Text style={styles.errorText}>{nameError}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Phone input ───────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("phoneOptional")}</Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name="call-outline"
                size={18}
                color={colors.text.muted}
                style={styles.inputIcon}
              />
              <TextInput
                ref={phoneInputRef}
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
              {phone.length > 0 && !saving && (
                <Pressable onPress={() => setPhone("")} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={16} color={colors.text.muted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* ── Cancel + Save row ─────────────────────────────────────────── */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.6 }]}
              disabled={saving}
            >
              <Text style={styles.cancelText}>{t("cancel")}</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveButton,
                !canSave && styles.saveButtonDisabled,
                pressed && canSave && styles.saveButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("saveCustomer")}
            >
              {saving ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>{t("saving")}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={canSave ? "#FFFFFF" : colors.text.muted} />
                  <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>
                    {t("saveCustomer")}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

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
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  kavWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: colors.background.tertiary,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14,
  },

  // ── Drag handle ────────────────────────────────────────────────────────────
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },

  divider: {
    height: 1,
    backgroundColor: colors.background.tertiary,
    marginVertical: 2,
  },

  // ── Import button ──────────────────────────────────────────────────────────
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.accent.teal + "50",
    backgroundColor: colors.accent.teal + "0D",
  },
  importButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
  importButtonDisabled: {
    opacity: 0.35,
  },
  importIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accent.teal + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  importTextBlock: {
    flex: 1,
  },
  importButtonTitle: {
    color: colors.accent.teal,
    fontSize: 15,
    fontWeight: "700",
  },
  importButtonSub: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 1,
  },

  // ── OR divider ─────────────────────────────────────────────────────────────
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.background.tertiary,
  },
  orText: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
  },

  // ── Form fields ────────────────────────────────────────────────────────────
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingLeft: 2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.background.tertiary,
    paddingHorizontal: 14,
  },
  inputWrapError: {
    borderColor: colors.debt,
    backgroundColor: colors.debt + "08",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 16,
    paddingVertical: 14,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    paddingLeft: 2,
  },
  errorText: {
    color: colors.debt,
    fontSize: 13,
    fontWeight: "500",
  },

  // ── Action row (Cancel + Save side by side) ──────────────────────────────
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },

  // ── Cancel ─────────────────────────────────────────────────────────────────
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.background.tertiary,
    backgroundColor: colors.background.primary,
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: "600",
  },

  // ── Save button ────────────────────────────────────────────────────────────
  saveButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent.teal,
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: colors.accent.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  saveButtonDisabled: {
    backgroundColor: colors.background.tertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  saveButtonTextDisabled: {
    color: colors.text.muted,
  },
});
