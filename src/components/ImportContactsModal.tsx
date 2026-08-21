/**
 * src/components/ImportContactsModal.tsx
 *
 * A modal allowing users to select and batch-import multiple (or all) contacts
 * from their phone's address book directly into Duka Deni.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Contacts from "expo-contacts/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeContext, Colors } from "../theme";
import { useLanguage } from "../store/LanguageContext";
import { db } from "../db";
import { getAllCustomers, addCustomersBatch } from "../repositories/customers";
import { NewCustomer } from "../types";
import { getInitials } from "../utils/strings";

interface ImportContactsModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

interface ContactItem {
  id: string;
  name: string;
  phone?: string;
  alreadyImported: boolean;
}

const AVATAR_COLORS = [
  "#0F766E",
  "#6B21A8",
  "#EF4444",
  "#475569",
  "#059669",
  "#0D9488",
  "#DB2777",
  "#2563EB",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function normalizePhone(phone?: string): string {
  if (!phone) return "";
  return phone.replace(/[\s\-()]/g, "").replace(/^\+254/, "0");
}

export function ImportContactsModal({ visible, onClose, onSuccess }: ImportContactsModalProps) {
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Load contacts from device & database when modal becomes visible
  useEffect(() => {
    if (!visible) {
      setContacts([]);
      setSelectedIds(new Set());
      setSearchQuery("");
      setLoading(false);
      setImporting(false);
      return;
    }

    let isMounted = true;

    async function loadContactsData() {
      try {
        setLoading(true);

        // 1. Request contact permissions
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== "granted") {
          if (isMounted) {
            setLoading(false);
            Alert.alert("", t("contactPermissionDenied"));
            onClose();
          }
          return;
        }

        // 2. Fetch device contacts
        const deviceContacts = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
          sort: Contacts.SortTypes.FirstName,
        });

        // 3. Fetch existing app customers to highlight existing contacts
        const existingCustomers = await getAllCustomers(db);
        const existingPhones = new Set(
          existingCustomers
            .map((c) => normalizePhone(c.phone))
            .filter((p) => p.length > 0)
        );
        const existingNames = new Set(
          existingCustomers.map((c) => c.name.trim().toLowerCase())
        );

        // 4. Map & filter device contacts
        const items: ContactItem[] = [];
        const defaultSelected = new Set<string>();

        if (deviceContacts?.data) {
          for (const c of deviceContacts.data) {
            const rawName = c.name || [c.firstName, c.lastName].filter(Boolean).join(" ");
            const name = rawName.trim();
            if (!name) continue;

            let phone: string | undefined = undefined;
            if (c.phoneNumbers && c.phoneNumbers.length > 0) {
              phone = c.phoneNumbers[0].number?.trim();
            }

            const normPhone = normalizePhone(phone);
            const alreadyImported =
              (normPhone && existingPhones.has(normPhone)) ||
              existingNames.has(name.toLowerCase());

            const item: ContactItem = {
              id: c.id || `${name}-${phone || Math.random()}`,
              name,
              phone,
              alreadyImported: Boolean(alreadyImported),
            };

            items.push(item);

            // Auto-select contacts that are not already in app
            if (!item.alreadyImported) {
              defaultSelected.add(item.id);
            }
          }
        }

        if (isMounted) {
          setContacts(items);
          setSelectedIds(defaultSelected);
          setLoading(false);
        }
      } catch (err) {
        console.warn("Failed to load contacts:", err);
        if (isMounted) {
          setLoading(false);
          Alert.alert("Error", "Could not load contacts from your device.");
        }
      }
    }

    loadContactsData();

    return () => {
      isMounted = false;
    };
  }, [visible]);

  // Filtered contacts based on search query
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [contacts, searchQuery]);

  // Selection state computations
  const unimportedContacts = useMemo(
    () => contacts.filter((c) => !c.alreadyImported),
    [contacts]
  );

  const isAllSelected = useMemo(() => {
    if (unimportedContacts.length === 0) return false;
    return unimportedContacts.every((c) => selectedIds.has(c.id));
  }, [unimportedContacts, selectedIds]);

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set<string>();
      unimportedContacts.forEach((c) => newSelected.add(c.id));
      setSelectedIds(newSelected);
    }
  }, [isAllSelected, unimportedContacts]);

  const toggleContact = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Perform bulk import
  const handleImport = useCallback(async () => {
    if (selectedIds.size === 0) return;

    try {
      setImporting(true);

      const itemsToImport = contacts.filter((c) => selectedIds.has(c.id));
      const newCustomers: NewCustomer[] = itemsToImport.map((c) => ({
        name: c.name,
        phone: c.phone ? c.phone.replace(/[\s\-()]/g, "") : undefined,
      }));

      const count = await addCustomersBatch(db, newCustomers);

      setImporting(false);
      onSuccess(count);
      onClose();

      Alert.alert(
        "✓ " + t("importFromContacts"),
        `${t("importSuccessMessage")}: ${count}`
      );
    } catch (err) {
      console.warn("Error importing contacts batch:", err);
      setImporting(false);
      Alert.alert("Error", t("failedToSaveError"));
    }
  }, [selectedIds, contacts, onSuccess, onClose, t]);

  const renderContactItem = useCallback(
    ({ item }: { item: ContactItem }) => {
      const isSelected = selectedIds.has(item.id);
      const avatarBg = getAvatarColor(item.name);
      const initials = getInitials(item.name);

      return (
        <Pressable
          onPress={() => toggleContact(item.id)}
          style={({ pressed }) => [
            styles.contactRowPressable,
            pressed && styles.contactRowPressed,
          ]}
        >
          <View style={styles.contactRowContent}>
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            {/* Details */}
            <View style={styles.contactMeta}>
              <View style={styles.nameRow}>
                <Text style={styles.contactName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.alreadyImported && (
                  <View style={styles.alreadyTag}>
                    <Text style={styles.alreadyTagText}>{t("alreadyImported")}</Text>
                  </View>
                )}
              </View>
              {item.phone ? (
                <Text style={styles.contactPhone} numberOfLines={1}>
                  {item.phone}
                </Text>
              ) : null}
            </View>

            {/* Checkbox */}
            <View style={styles.checkboxContainer}>
              <Ionicons
                name={isSelected ? "checkbox" : "square-outline"}
                size={22}
                color={isSelected ? colors.accent.teal : colors.text.muted}
              />
            </View>
          </View>
        </Pressable>
      );
    },
    [selectedIds, toggleContact, colors, styles, t]
  );

  const ItemSeparator = useCallback(
    () => <View style={styles.itemSeparator} />,
    [styles.itemSeparator]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.title}>{t("importFromContacts")}</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.accent.teal} />
            <Text style={styles.loadingText}>{t("importingContacts")}</Text>
          </View>
        ) : (
          <>
            {/* Search input */}
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <Ionicons
                  name="search"
                  size={18}
                  color={colors.text.muted}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t("searchContactsPlaceholder")}
                  placeholderTextColor={colors.text.muted}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </View>
            </View>

            {/* Selection control bar */}
            <View style={styles.controlRow}>
              <Pressable
                onPress={toggleSelectAll}
                style={styles.selectAllBtn}
                disabled={unimportedContacts.length === 0}
              >
                <Ionicons
                  name={isAllSelected ? "checkbox" : "square-outline"}
                  size={20}
                  color={colors.accent.teal}
                />
                <Text style={styles.selectAllText}>
                  {isAllSelected ? t("deselectAllContacts") : t("selectAllContacts")}
                </Text>
              </Pressable>

              <Text style={styles.countBadge}>
                {t("selectedCount")}: {selectedIds.size} / {contacts.length}
              </Text>
            </View>

            {/* Contacts list */}
            {filteredContacts.length === 0 ? (
              <View style={styles.centerContainer}>
                <Ionicons
                  name="person-circle-outline"
                  size={48}
                  color={colors.text.muted}
                />
                <Text style={styles.noContactsText}>{t("noContactsFound")}</Text>
              </View>
            ) : (
              <FlatList
                data={filteredContacts}
                keyExtractor={(item) => item.id}
                renderItem={renderContactItem}
                ItemSeparatorComponent={ItemSeparator}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: insets.bottom + 90 },
                ]}
                showsVerticalScrollIndicator={false}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={5}
              />
            )}

            {/* Bottom Action Footer */}
            <View
              style={[
                styles.bottomBar,
                { paddingBottom: Math.max(insets.bottom, 16) },
              ]}
            >
              <Pressable
                onPress={handleImport}
                disabled={selectedIds.size === 0 || importing}
                style={({ pressed }) => [
                  styles.importButton,
                  pressed && styles.importButtonPressed,
                  (selectedIds.size === 0 || importing) && styles.importButtonDisabled,
                ]}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.importButtonText}>
                      {t("importSelectedContacts")} ({selectedIds.size})
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.background.tertiary,
    },
    closeButton: {
      padding: 6,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text.primary,
    },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 32,
    },
    loadingText: {
      color: colors.text.secondary,
      fontSize: 15,
    },
    noContactsText: {
      color: colors.text.muted,
      fontSize: 15,
      textAlign: "center",
    },
    searchRow: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    searchIcon: {
      marginRight: 6,
    },
    searchInput: {
      flex: 1,
      color: colors.text.primary,
      fontSize: 14,
      paddingVertical: 10,
    },
    controlRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.background.tertiary,
    },
    selectAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
    },
    selectAllText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent.teal,
    },
    countBadge: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.text.secondary,
    },
    listContent: {
      paddingTop: 4,
    },
    contactRowPressable: {
      width: "100%",
    },
    contactRowPressed: {
      backgroundColor: colors.background.secondary,
    },
    contactRowContent: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      width: "100%",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      flexShrink: 0,
    },
    avatarText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    contactMeta: {
      flex: 1,
      justifyContent: "center",
      marginRight: 8,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    contactName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text.primary,
      flexShrink: 1,
    },
    alreadyTag: {
      backgroundColor: colors.background.tertiary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    alreadyTagText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.text.muted,
    },
    contactPhone: {
      fontSize: 13,
      color: colors.text.secondary,
      marginTop: 2,
    },
    checkboxContainer: {
      flexShrink: 0,
      paddingLeft: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    itemSeparator: {
      height: 1,
      backgroundColor: colors.background.tertiary,
      marginLeft: 72,
    },
    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.background.primary,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.background.tertiary,
      elevation: 10,
    },
    importButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent.teal,
      borderRadius: 14,
      paddingVertical: 14,
      gap: 8,
    },
    importButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    importButtonDisabled: {
      opacity: 0.5,
    },
    importButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
  });
