import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useThemeContext } from '../theme';

interface PickerOption {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function SettingsPickerModal({ visible, title, options, selectedValue, onSelect, onClose }: Props) {
  const { colors } = useThemeContext();

  const styles = StyleSheet.create({
    overlay: { 
      flex: 1, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      justifyContent: 'flex-end' 
    },
    sheet: { 
      backgroundColor: colors.background.primary, 
      borderTopLeftRadius: 20, 
      borderTopRightRadius: 20, 
      padding: 20,
      paddingBottom: 40,
    },
    title: { 
      fontSize: 18, 
      fontWeight: '700', 
      color: colors.text.primary, 
      marginBottom: 16 
    },
    option: { 
      paddingVertical: 16, 
      borderBottomWidth: 1, 
      borderBottomColor: colors.background.tertiary, 
      flexDirection: 'row', 
      justifyContent: 'space-between' 
    },
    optionText: { 
      fontSize: 16, 
      color: colors.text.primary 
    },
    selectedText: { 
      color: colors.accent.teal, 
      fontWeight: '700' 
    },
    cancelBtn: { 
      marginTop: 24, 
      paddingVertical: 14, 
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
    },
    cancelText: { 
      fontSize: 16, 
      fontWeight: '600', 
      color: colors.text.primary 
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {options.map((opt) => (
            <Pressable key={opt.value} style={styles.option} onPress={() => { onSelect(opt.value); onClose(); }}>
              <Text style={[styles.optionText, selectedValue === opt.value && styles.selectedText]}>{opt.label}</Text>
              {selectedValue === opt.value && <Text style={styles.selectedText}>✓</Text>}
            </Pressable>
          ))}
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
