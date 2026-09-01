# Duka Deni — APK Build Changes & Keyboard Troubleshooting Guide

**Date**: 31 Aug 2026  
**Environment**: Expo / React Native (Android APK & iOS)  

---

## 1. Summary of Recent UI & Modal Changes

### 📱 A. Add Customer Modal (`src/components/AddCustomerModal.tsx`)
- **Header & Dismissal**: Added title, subtitle ("Fill in the details below"), and top-right `✕` close button.
- **Import from Contacts**: Formatted as a prominent card with icon container, title, and descriptive subtitle (*"Pick one or more from your phone book"*).
- **Form Fields**: Input containers feature leading icons (`person-outline`, `call-outline`), inline clear `✕` buttons, and active error indicators.
- **Save Button**: Prominent teal button card with a checkmark icon `✓` and bold white text. Styled to maintain button container visibility in both Light and Dark themes when disabled.

---

### 💳 B. Add Transaction / Debt Modal (`src/components/AddTransactionModal.tsx`)
- **Header**: Added title with top-right `✕` close button.
- **Hero Amount**: Large centered amount display (`KES 1,250.00`).
- **Note Input**: Labeled section with placeholder `"e.g. Ung'a, Sukari"`.
- **Primary Action Button**: Full-width **Record Debt** / **Record Payment** button with teal glow shadow.

---

### 🔢 C. Numeric Keypad (`src/components/Numpad.tsx`)
- **Clean Numeric Keypad**: Added `showSubLabels` prop (default `false`) to hide telephone letters (`ABC`, `DEF`, `GHI`).
- **Tactile Surfaces**: Sleek rounded keys with subtle 1px borders and low-contrast dark surfaces.

---

## 2. In-Depth Technical Analysis: Keyboard Overlapping Inputs in APK Builds

### ❓ Question 1: Why does keyboard behavior differ between Expo Go and APK build?

In **Expo Go**, the host app runs in a single Android Activity (`ExperienceActivity`) configured with global window flags (`adjustResize`, edge-to-edge handlers, and custom debug window flags). Expo Go’s parent activity forces all sub-views and overlay layers to adapt dynamically when the soft keyboard appears.

In a **standalone Android APK build**, React Native's `<Modal>` component creates a **native Android `android.app.Dialog` window (`ReactModalHostView`)** that is isolated from `MainActivity`. 
- The native Android `Dialog` window does **NOT** automatically inherit `windowSoftInputMode` from `MainActivity`.
- Unless explicitly configured, the Android OS applies default `Dialog` window parameters (`adjustPan` or `adjustUnspecified`), causing the keyboard to render on top of the modal content without pushing or resizing the modal container upwards.

---

### ⚙️ Question 2: How `windowSoftInputMode` and `softwareKeyboardLayoutMode` affect behavior

1. **`softwareKeyboardLayoutMode` in `app.json`**:
   Configures the `android:windowSoftInputMode` attribute inside `AndroidManifest.xml` for `MainActivity`:
   ```json
   "android": {
     "softwareKeyboardLayoutMode": "adjustResize"
   }
   ```
2. **`adjustResize` vs `adjustPan`**:
   - `adjustResize`: The Android OS resizes the `MainActivity` viewport when the soft keyboard toggles, freeing up screen space for focused input fields.
   - `adjustPan`: The OS keeps window dimensions fixed and pans/shifts the entire screen content upwards.
3. **The Catch with React Native `<Modal>`**:
   Setting `"softwareKeyboardLayoutMode": "adjustResize"` in `app.json` **only applies to `MainActivity`**. Because React Native's `<Modal>` renders inside a separate `Dialog` window hierarchy, the modal window ignores `MainActivity`'s `adjustResize` setting in compiled APK binaries.

---

### 📊 Question 3: Comparison of Keyboard Handling Approaches

| Approach | Best Use Case | Android APK Behavior | Pros | Cons |
| :--- | :--- | :--- | :--- | :--- |
| **`KeyboardAvoidingView`** | Standard views / iOS modals | Needs `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` on Android with `adjustResize`. | Built into React Native core. | Fails inside Android `<Modal>` if dialog window size is fixed; can cause "double shrink" if behavior is set to `height` or `padding` on Android. |
| **`ScrollView` + `keyboardShouldPersistTaps`** | Scrollable forms | Works cleanly when combined with proper inset padding. | Prevents taps from closing keyboard accidentally; allows manual scroll to input. | Requires form content to be wrapped inside a `ScrollView`. |
| **`KeyboardAwareScrollView`** | Multi-input forms | High reliability; auto-scrolls to focused input position. | Handles keyboard height offsets automatically across iOS and Android. | Third-party dependency (`react-native-keyboard-aware-scroll-view`). |
| **`@gorhom/bottom-sheet`** | Complex bottom sheets | Excellent; handles keyboard offsets natively via `keyboardBehavior="interactive"`. | Full gesture control, smooth animations, native keyboard awareness. | Replaces React Native `<Modal>` with reanimated view layers. |

---

### 🚨 Question 4: Common Causes of Modal Keyboard Failure in Production APKs

1. **Native Dialog Window Isolation**: React Native `<Modal>` dialog window defaults to `adjustPan` on Android release builds, ignoring `app.json` settings.
2. **Double Shrinking**: Using `behavior="padding"` or `behavior="height"` on `KeyboardAvoidingView` on Android when `softwareKeyboardLayoutMode` is already `adjustResize` causes a double layout shrink, pushing content down.
3. **Fixed Container Height**: Using fixed `height` (e.g. `height: 500`) on modal sheet containers instead of `maxHeight`, `flexShrink`, or wrapping inputs inside a `ScrollView`.
4. **`statusBarTranslucent` Insets**: When `<Modal statusBarTranslucent={true}>` is enabled on Android, system bar insets shift, causing layout calculations to ignore the bottom software keyboard inset.

---

## 3. Production Fix for Android Modal Keyboard Overlap & Numpad Redesign

### 🛠️ Solution Architecture for Modal Keyboard Handling

To guarantee that bottom sheet modals slide up cleanly above the soft keyboard in standalone APKs:

1. **`statusBarTranslucent` on `<Modal>`**:
   Enables the native Android Dialog window to accurately measure system status bar and navigation bar insets.

2. **`Keyboard.addListener('keyboardDidShow')` Height Tracking**:
   Since `KeyboardAvoidingView` with `behavior="height"` fails in separate Dialog windows, we manually listen to system `keyboardDidShow` / `keyboardDidHide` events and dynamically append `paddingBottom: keyboardHeight` to the sheet's `ScrollView`.

3. **Auto-Scroll to Focused Inputs**:
   Trigger `scrollViewRef.current?.scrollToEnd({ animated: true })` on keyboard reveal so input fields and confirm buttons automatically elevate above the keyboard.

4. **Fintech Numpad UI Redesign**:
   - Replaced bulky phone-dialer circles with lightweight, flat `88×52` rounded keys.
   - Removed legacy telephone sub-labels (`ABC`, `DEF`, `GHI`).
   - Added subtle press-scale micro-animations (`transform: [{ scale: 0.95 }]`) with zero layout reflow.

```tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ProductionFormModal({ visible, onClose, onSave }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Tap backdrop to dismiss */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        /* IMPORTANT: On Android with adjustResize, behavior must be undefined to avoid double-shrink */
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kavWrapper}
      >
        <View style={styles.sheet}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.dragHandle} />
            <Text style={styles.title}>New Customer</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Kamau Wanjiku"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 0712 345 678"
                keyboardType="phone-pad"
                returnKeyType="done"
              />
            </View>

            <Pressable onPress={onSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Customer</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  kavWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 16,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  saveBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
```

---

### Strategy 2: Alternative Non-Modal Overlay (In-Tree View Sheet)

If native Android `Dialog` window behavior causes edge-case issues in custom Android ROMs (e.g. MIUI, OneUI), render the bottom sheet as an **in-tree absolute overlay View** instead of React Native `<Modal>`. 

Because an in-tree overlay resides inside `MainActivity`, it **100% respects `softwareKeyboardLayoutMode: "adjustResize"` in standalone APKs**.

---

## 4. Summary Checklist for Production Builds

- [x] Set `"softwareKeyboardLayoutMode": "adjustResize"` in `app.json`.
- [x] Set `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` on `KeyboardAvoidingView`.
- [x] Wrap input fields inside a `ScrollView` with `keyboardShouldPersistTaps="handled"`.
- [x] Use `maxHeight: '85%'` or `flexShrink: 1` on sheet containers instead of fixed height pixel dimensions.
- [x] Test standalone `.apk` builds directly on physical Android devices.
