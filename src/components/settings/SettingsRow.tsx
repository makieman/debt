import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../../theme';

interface SettingsRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  title: string;
  subtitle?: string;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  showChevron = true,
  rightElement,
  onPress,
  onLongPress,
}) => {
  const { colors } = useThemeContext();

  const handlePress = () => {
    // If we have a rightElement (like a Switch), we let the rightElement handle its own press.
    // If the user clicks the row body, we only fire onPress if there's no rightElement or if specifically desired.
    // In this app, rows with Switches don't have separate navigation actions.
    if (onPress && !rightElement) {
      onPress();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [
        { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.background.tertiary },
        pressed && (onPress || onLongPress) && { backgroundColor: colors.background.secondary },
      ]}
    >
      <View style={styles.container}>
        <View style={styles.leftSection}>
          <View style={[styles.iconWrapper, { backgroundColor: colors.background.tertiary }]}>
            <Ionicons name={icon as any} size={20} color={iconColor || colors.text.primary} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rightSection}>
          {rightElement ? (
            // Use onStartShouldSetResponder to capture touches so that tapping the Switch
            // doesn't trigger the row's outer Pressable highlights or actions.
            <View onStartShouldSetResponder={() => true} style={styles.rightElementWrapper}>
              {rightElement}
            </View>
          ) : showChevron ? (
            <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightElementWrapper: {
    // Ensure the switch doesn't get clipped and sits centered
    justifyContent: 'center',
    alignItems: 'center',
  },
});
