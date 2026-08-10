/**
 * src/components/RemindersModal.tsx
 *
 * Modal launched from the Dashboard bell icon showing payment reminders
 * and quick actions (WhatsApp, Call/SMS) for customers with outstanding debt.
 */

import React, { useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
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

const DebtorCardItem = React.memo(function DebtorCardItem({
  debtor,
  currency,
  t,
  onWhatsApp,
  onSelectCustomer,
  styles,
}: {
  debtor: TopDebtor;
  currency: string;
  t: (key: any) => string;
  onWhatsApp: (debtor: TopDebtor) => void;
  onSelectCustomer?: (customerId: number) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const avatarBg = getAvatarColor(debtor.name);
  const initials = getInitials(debtor.name);

  return (
    <View style={styles.debtorCard}>
      <View style={styles.debtorInfoRow}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.debtorMeta}>
          <Text style={styles.debtorName} numberOfLines={1}>
            {debtor.name}
          </Text>
          <Text style={styles.debtorBalance}>
            {t('owes')}{' '}
            <Text style={styles.balanceHighlight}>
              {formatMoney(debtor.balance, currency)}
            </Text>
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.whatsappBtn}
          onPress={() => onWhatsApp(debtor)}
        >
          <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
          <Text style={styles.whatsappBtnText}>WhatsApp</Text>
        </Pressable>

        {onSelectCustomer && (
          <Pressable
            style={styles.viewBtn}
            onPress={() => onSelectCustomer(debtor.customerId)}
          >
            <Text style={styles.viewBtnText}>{t('viewAll') || 'View'}</Text>
            <Ionicons name="chevron-forward" size={14} color={styles.viewBtnText.color} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

export const RemindersModal = React.memo(function RemindersModal({
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
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
          await Linking.openURL(`https://api.whatsapp.com/send?text=${encoded}`);
        }
      } catch (err) {
        Alert.alert(
          'Unable to open WhatsApp',
          'Please ensure WhatsApp is installed on your device.'
        );
      }
    },
    [currency, shopName, language]
  );

  const handleSelectCustomer = useCallback(
    (customerId: number) => {
      onClose();
      onSelectCustomer?.(customerId);
    },
    [onClose, onSelectCustomer]
  );

  const renderItem = useCallback(
    ({ item }: { item: TopDebtor }) => (
      <DebtorCardItem
        debtor={item}
        currency={currency}
        t={t}
        onWhatsApp={sendWhatsAppReminder}
        onSelectCustomer={onSelectCustomer ? handleSelectCustomer : undefined}
        styles={styles}
      />
    ),
    [currency, t, sendWhatsAppReminder, onSelectCustomer, handleSelectCustomer, styles]
  );

  const keyExtractor = useCallback((item: TopDebtor) => String(item.customerId), []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlayContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="notifications" size={24} color={colors.accent.teal} />
              <Text style={styles.title}>
                {t('notificationReminders') || 'Payment Reminders'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            {(topDebtors?.length ?? 0) > 0
              ? `${topDebtors.length} ${
                  topDebtors.length === 1 ? 'customer has' : 'customers have'
                } pending balances`
              : 'All customer accounts are settled'}
          </Text>

          {/* Debtors List */}
          {(topDebtors?.length ?? 0) === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="checkmark-circle-outline"
                size={48}
                color={colors.payment}
              />
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptyText}>
                No pending payment reminders right now.
              </Text>
            </View>
          ) : (
            <FlatList
              data={topDebtors}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              scrollEventThrottle={16}
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={5}
            />
          )}
        </View>
      </View>
    </Modal>
  );
});

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    overlayContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    balanceHighlight: {
      color: colors.debt,
      fontWeight: '700',
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
