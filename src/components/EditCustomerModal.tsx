/**
 * src/components/EditCustomerModal.tsx
 *
 * A bottom-sheet style modal for editing or deactivating (soft deleting) an existing customer.
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
} from "react-native";
import { useThemeContext, Colors } from "../theme";
import { useLanguage } from "../store/LanguageContext";
import { updateCustomer, deleteCustomer } from "../repositories/customers";
import { Customer } from "../types";
import { db } from "../db";

interface EditCustomerModalProps {
  visible: boolean;
  customer: Customer;
  onClose: () => void;
  onSuccess: (deleted?: boolean) => void; // pass true if deleted to handle navigation
}

export function EditCustomerModal({
  visible,
  customer,
  onClose,
  onSuccess,
}: EditCustomerModalProps) {
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const styles = makeStyles(colors);

  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || "");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  const nameInputRef = useRef<TextInput>(null);

  // Sync state when customer changes or modal opens
  useEffect(() => {
    if (visible) {
      setName(customer.name);
      setPhone(customer.phone || "");
      setNameError("");
      setSaving(false);

      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [visible, customer]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t('enterCustomerNameError'));
      return;
    }

    try {
      setSaving(true);
      await updateCustomer(db, customer.id, {
        name: trimmedName,
        phone: phone.trim() || null,
      });
      onSuccess(false);
      onClose();
    } catch (error) {
      setNameError(t('failedToSaveError'));
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('deleteConfirmTitle'),
      t('confirmDeleteCustomer'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('disable'), // "Zima" in Swahili, deactivates them
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deleteCustomer(db, customer.id);
              onSuccess(true);
              onClose();
            } catch (error) {
              setNameError(t('failedToSaveError'));
              setSaving(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kavWrapper}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.sheetTitle}>{t('editCustomer')}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('nameRequired')}</Text>
              <TextInput
                ref={nameInputRef}
                style={[styles.input, nameError ? styles.inputError : null]}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError("");
                }}
                placeholder={t('placeholderName')}
                placeholderTextColor={colors.text.muted}
                maxLength={40}
                editable={!saving}
              />
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            </View>

            {/* Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('phoneOptional')}</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder={t('placeholderPhone')}
                placeholderTextColor={colors.text.muted}
                keyboardType="phone-pad"
                maxLength={20}
                editable={!saving}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && styles.btnPressed,
                  saving && styles.btnDisabled,
                ]}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? t('saving') : t('save')}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                disabled={saving}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  pressed && styles.btnPressed,
                  saving && styles.btnDisabled,
                ]}
              >
                <Text style={styles.deleteBtnText}>
                  {t('deleteCustomer')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 17, 23, 0.7)",
    },
    kavWrapper: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text.primary,
    },
    closeBtn: {
      padding: 6,
    },
    closeBtnText: {
      fontSize: 16,
      color: colors.text.muted,
    },
    form: {
      gap: 16,
    },
    inputGroup: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text.secondary,
    },
    input: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    inputError: {
      borderColor: colors.debt,
    },
    errorText: {
      fontSize: 12,
      color: colors.debt,
      marginTop: 2,
    },
    buttonContainer: {
      flexDirection: "column",
      gap: 10,
      marginTop: 8,
    },
    saveBtn: {
      backgroundColor: colors.accent.teal,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: "600",
    },
    deleteBtn: {
      backgroundColor: colors.background.secondary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.debt + "40",
    },
    deleteBtnText: {
      color: colors.debt,
      fontSize: 16,
      fontWeight: "600",
    },
    btnPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });
