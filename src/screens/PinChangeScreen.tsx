/**
 * src/screens/PinChangeScreen.tsx
 *
 * A 3-step state machine for changing an existing PIN:
 *
 *   Step 1: "change-current" — verify the CURRENT PIN
 *     Security: prevents someone who finds an unlocked phone from
 *     changing the PIN and locking out the real owner. Same pattern
 *     used by every banking app. You can't change credentials without
 *     proving you know the current ones.
 *
 *   Step 2: "change-new" — enter the NEW PIN
 *     Stored temporarily in component state.
 *
 *   Step 3: "change-confirm" — confirm the new PIN
 *     PinScreen verifies match internally, calls setPin() to overwrite
 *     the old hash, then calls onSuccess().
 *
 * ─── WHY REQUIRE THE CURRENT PIN? ────────────────────────────────────────────
 * Scenario: Phone is left unlocked on a counter. A stranger picks it up.
 * If changing the PIN required no verification, they could set a new PIN
 * and lock the real owner out permanently.
 *
 * Requiring the current PIN means:
 *   - Only someone who KNOWS the PIN can change it
 *   - Even on an unlocked device, the shopkeeper's credentials are protected
 *
 * This is the same principle as: your bank requires your current password
 * before letting you set a new one.
 */

import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { PinScreen } from './PinScreen';
import { useSecurityContext } from '../store/SecurityContext';

type ChangeStep = 'current' | 'new' | 'confirm';
type ChangeNavProp = NativeStackNavigationProp<RootStackParamList, 'PinChange'>;

export function PinChangeScreen() {
  const navigation = useNavigation<ChangeNavProp>();
  const { refreshSecurityState } = useSecurityContext();

  const [step, setStep] = useState<ChangeStep>('current');
  const [newPin, setNewPin] = useState('');

  const handleCurrentSuccess = () => {
    // Current PIN verified — proceed to new PIN entry
    setStep('new');
  };

  const handleNewSuccess = (pin?: string) => {
    if (pin) {
      setNewPin(pin);
      setStep('confirm');
    }
  };

  const handleConfirmSuccess = async () => {
    // setPin() was already called inside PinScreen (mode="change-confirm")
    await refreshSecurityState();
    Alert.alert('✅ PIN Changed', 'Your PIN has been updated successfully.');
    navigation.goBack();
  };

  const handleConfirmFail = () => {
    // Confirmation didn't match — go back to new PIN entry
    setStep('new');
    setNewPin('');
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  switch (step) {
    case 'current':
      return (
        <PinScreen
          key="current"
          mode="change-current"
          onSuccess={handleCurrentSuccess}
          onCancel={handleCancel}
        />
      );
    case 'new':
      return (
        <PinScreen
          key="new"
          mode="change-new"
          onSuccess={handleNewSuccess}
          onCancel={handleCancel}
        />
      );
    case 'confirm':
      return (
        <PinScreen
          key="confirm"
          mode="change-confirm"
          enteredPin={newPin}
          onSuccess={handleConfirmSuccess}
          onCancel={handleConfirmFail}
        />
      );
  }
}
