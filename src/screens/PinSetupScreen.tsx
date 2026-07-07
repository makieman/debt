/**
 * src/screens/PinSetupScreen.tsx
 *
 * A state-machine wrapper that walks the user through the 2-step PIN setup:
 *
 *   Step 1: PinScreen mode="setup"
 *     → user enters their chosen PIN (4 digits)
 *     → we store it temporarily in state (NOT SecureStore yet)
 *
 *   Step 2: PinScreen mode="setup-confirm" enteredPin={step1Pin}
 *     → user re-enters the same PIN
 *     → if they match: PinScreen calls setPin() internally and calls onSuccess()
 *     → if they don't match: PinScreen shows error and we go back to step 1
 *
 * ─── WHY A STATE MACHINE, NOT NESTED NAVIGATION? ─────────────────────────────
 * We could push two separate screens onto the stack. But then the user could
 * go "back" from the confirm screen to the create screen — and the first PIN
 * they entered would still be visible. That's a subtle UX problem.
 *
 * Using a local state machine means we control the entire flow in one component.
 * The "back" gesture (swipe/hardware back) goes back to Settings, not to step 1.
 *
 * ─── WHY fullScreenModal? ─────────────────────────────────────────────────────
 * presentation: "fullScreenModal" in React Navigation does two things:
 *   1. On Android: the screen slides up from the bottom edge
 *   2. The header from parent navigators is suppressed
 *   3. The tab bar is fully hidden (the screen covers everything)
 *
 * This makes PIN setup feel like a serious, focused task — not a sub-page
 * of Settings. Compare: iOS Screen Time PIN setup uses the same presentation.
 */

import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { PinScreen } from './PinScreen';
import { useSecurityContext } from '../store/SecurityContext';

type SetupStep = 'enter' | 'confirm';
type SetupNavProp = NativeStackNavigationProp<RootStackParamList, 'PinSetup'>;

export function PinSetupScreen() {
  const navigation = useNavigation<SetupNavProp>();
  const { refreshSecurityState } = useSecurityContext();

  const [step, setStep] = useState<SetupStep>('enter');
  const [firstPin, setFirstPin] = useState('');

  const handleEnterSuccess = (pin?: string) => {
    if (pin) {
      setFirstPin(pin);
      setStep('confirm');
    }
  };

  const handleConfirmSuccess = async () => {
    // setPin() was already called inside PinScreen (mode="setup-confirm")
    // Now we refresh context so isAppLockEnabled and pinSetupComplete update.
    await refreshSecurityState();
    navigation.goBack();
  };

  const handleConfirmFail = () => {
    // PINs didn't match — reset to step 1
    setStep('enter');
    setFirstPin('');
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (step === 'enter') {
    return (
      <PinScreen
        key="enter"
        mode="setup"
        onSuccess={handleEnterSuccess}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <PinScreen
      key="confirm"
      mode="setup-confirm"
      enteredPin={firstPin}
      onSuccess={handleConfirmSuccess}
      onCancel={handleConfirmFail}
    />
  );
}
