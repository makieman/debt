/**
 * src/components/RemindersModal.tsx
 *
 * Modal launched from the Dashboard bell icon showing payment reminders
 * and quick actions (WhatsApp, Call/SMS) for customers with outstanding debt.
 */

import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext, Colors } from '../theme';
import { useShopProfile } from '../store/ShopProfileContext';
import { useLanguage } from '../store/LanguageContext';
import { TopDebtor } from '../types';
import { formatMoney } from '../utils/money';
import { getInitials } from '../utils/strings';

interface RemindersModalProps {
  visible: boolean;
  topDebtors: TopDebtor[];
  onClose: () => void;
  onSelectCustomer?: (customerId: number) => void;
}

const AVATAR_COLORS = [
  '#0F766E',
  '#6B21A8',
  '#EF4444',
  '#475569',
  '#059669',
  '#0D9488',
  '#DB2777',
  '#2563EB',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function RemindersModal({
  visible,
  topDebtors = [],
  onClose,
  onSelectCustomer,
}: RemindersModalProps) {
  const { colors } = useThemeContext();
  const { profile } = useShopProfile();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const currency = profile?.currency || 'KES';
  const language = profile?.language || 'en';
  const shopName = profile?.ownerName || 'our shop';
  const styles = makeStyles(colors);

  const sendWhatsAppReminder = useCallback(
    async (debtor: TopDebtor) => {
      const amountStr = formatMoney(debtor.balance, currency);
      const isSwahili = language === 'sw';
      
      const message = isSwahili
        ? `Habari ${debtor.name} 👋, huu ni ukumbusho wa kirafiki kutoka ${shopName} kuhusu salio lako la deni la ${amountStr}. Asante!`
        : `Hello ${debtor.name} 👋, this is a friendly reminder from ${shopName} regarding your outstanding balance of ${amountStr}. Thank you!`;

      const encoded = encodeURIComponent(message);
      const url = `whatsapp://send?text=${encoded}`;

      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          // Fallback to web WhatsApp link
          await Linking.openURL(`https://api.whatsapp.com/send?text=${encoded}`);
        }
      } catch (err) {
        Alert.alert('Unable to open WhatsApp', 'Please ensure WhatsApp is installed on your device.');
      }
    },
    [currency, shopName, language]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
          ]}
          onPress={() => {}}
        >
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="notifications" size={24} color={colors.accent.teal} />
              <Text style={styles.title}>{t('notificationReminders') || 'Payment Reminders'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            {(topDebtors?.length ?? 0) > 0
              ? `${topDebtors.length} ${topDebtors.length === 1 ? 'customer has' : 'customers have'} pending balances`
              : 'All customer accounts are settled'}
          </Text>

          {/* Debtors List */}
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {(topDebtors?.length ?? 0) === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color={colors.payment} />
                <Text style={styles.emptyTitle}>All Clear!</Text>
                <Text style={styles.emptyText}>No pending payment reminders right now.</Text>
              </View>
            ) : (
              topDebtors.map((debtor) => {
                const avatarBg = getAvatarColor(debtor.name);
                const initials = getInitials(debtor.name);
                return (
                  <View key={debtor.customerId} style={styles.debtorCard}>
                    <View style={styles.debtorInfoRow}>
                      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                        <Text style={styles.avatarText}>{initials}</Text>
                      </View>
                      <View style={styles.debtorMeta}>
                        <Text style={styles.debtorName} numberOfLines={1}>
                          {debtor.name}
                        </Text>
                        <Text style={styles.debtorBalance}>
                          {t('owes')} <Text style={{ color: colors.debt, fontWeight: '700' }}>{formatMoney(debtor.balance, currency)}</Text>
                        </Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.whatsappBtn}
                        onPress={() => sendWhatsAppReminder(debtor)}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                        <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                      </Pressable>

                      {onSelectCustomer && (
                        <Pressable
                          style={styles.viewBtn}
                          onPress={() => {
                            onClose();
                            onSelectCustomer(debtor.customerId);
                          }}
                        >
                          <Text style={styles.viewBtnText}>{t('viewAll') || 'View'}</Text>
                          <Ionicons name="chevron-forward" size={14} color={colors.accent.teal} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      maxHeight: '85%',
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.background.tertiary,
      alignSelf: 'center',
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.text.secondary,
      marginBottom: 16,
    },
    listContainer: {
      flexGrow: 1,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 36,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
    },
    emptyText: {
      fontSize: 13,
      color: colors.text.muted,
      textAlign: 'center',
    },
    debtorCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
      gap: 12,
    },
    debtorInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    debtorMeta: {
      flex: 1,
    },
    debtorName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 2,
    },
    debtorBalance: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.background.tertiary,
    },
    whatsappBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#25D366',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    whatsappBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    viewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    viewBtnText: {
      color: colors.accent.teal,
      fontSize: 13,
      fontWeight: '600',
    },
  });
