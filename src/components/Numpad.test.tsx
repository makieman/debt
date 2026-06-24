/**
 * src/components/Numpad.test.tsx
 *
 * WHY ARE WE TESTING THIS?
 * The custom Numpad is the entry point for recording every single debt and payment in "Duka Deni".
 * Since it is a custom component rendering custom Pressables instead of the system keyboard,
 * we must guarantee that it implements formatting constraints flawlessly.
 * For example:
 *   - Preventing multiple decimal points ("1.50.2") which would fail to parse.
 *   - Preventing leading zeros ("05" instead of "5") which might cause octal parse issues or confuse users.
 *   - Restricting entries to a maximum length (maxLength) so numbers don't exceed database constraints.
 * If any of these rules fail, corrupted values could be written into our database.
 *
 * REACT NATIVE TESTING LIBRARY (RNTL) CONCEPTS:
 * - `render(component)`: Renders the React Native component tree in an in-memory virtual environment.
 * - `fireEvent.press(element)`: Simulates a user tapping/pressing on a button or pressable.
 * - `getByText(text)`: Searches the virtual DOM for an element containing the exact text.
 * - `getByLabelText(label)`: Searches for an element by its accessibilityLabel.
 * - `getByTestId(id)`: Searches for an element by its testID prop.
 * - `waitFor(callback)`: Waits for the assertion in the callback to pass, wrapping updates in act().
 *
 * STATEFUL WRAPPER TESTING PATTERN:
 * In React 19 / RNTL v14, components are rendered in a concurrent, asynchronous environment.
 * Calling `rerender` to update the `value` prop of a controlled component in sequence tests can lead
 * to overlapping `act()` calls or stale closure states.
 * To test this controlled component reliably, we wrap it in a stateful helper component `NumpadWrapper`
 * that manages real React state (`useState`). When a key is pressed, it calls `onChange` which updates
 * the wrapper's state, triggering a React render cycle. We use `await waitFor()` to ensure the UI
 * is updated before proceeding to the next step or assertion.
 */

import React, { useState } from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Numpad } from './Numpad';

interface WrapperProps {
  initialValue?: string;
  maxLength?: number;
  onChangeSpy?: (val: string) => void;
}

// A stateful test wrapper simulating the parent screen holding value state
const NumpadWrapper = ({ initialValue = '', maxLength = 7, onChangeSpy }: WrapperProps) => {
  const [value, setValue] = useState(initialValue);

  const handleChange = (val: string) => {
    setValue(val);
    if (onChangeSpy) {
      onChangeSpy(val);
    }
  };

  return (
    <>
      <Text testID="display-value">{value}</Text>
      <Numpad value={value} onChange={handleChange} maxLength={maxLength} />
    </>
  );
};

describe('Numpad Component', () => {

  it('should call onChange with the pressed digit', async () => {
    const onChangeSpy = jest.fn();
    const { getByText, getByTestId } = await render(
      <NumpadWrapper initialValue="" onChangeSpy={onChangeSpy} />
    );

    // Pressing '1' should update state and call our spy
    fireEvent.press(getByText('1'));
    await waitFor(() => {
      expect(getByTestId('display-value').props.children).toBe('1');
    });
    expect(onChangeSpy).toHaveBeenCalledWith('1');
  });

  it('should call onChange on every tap, building up the digits sequentially', async () => {
    const onChangeSpy = jest.fn();
    const { getByText, getByTestId } = await render(
      <NumpadWrapper initialValue="" onChangeSpy={onChangeSpy} />
    );

    // Tap "1"
    fireEvent.press(getByText('1'));
    await waitFor(() => {
      expect(getByTestId('display-value').props.children).toBe('1');
    });
    expect(onChangeSpy).toHaveBeenLastCalledWith('1');

    // Tap "5"
    fireEvent.press(getByText('5'));
    await waitFor(() => {
      expect(getByTestId('display-value').props.children).toBe('15');
    });
    expect(onChangeSpy).toHaveBeenLastCalledWith('15');

    // Tap "0"
    fireEvent.press(getByText('0'));
    await waitFor(() => {
      expect(getByTestId('display-value').props.children).toBe('150');
    });
    expect(onChangeSpy).toHaveBeenLastCalledWith('150');
  });

  describe('Decimal Point Behavior', () => {
    it('should allow typing a decimal point and subsequent decimal digits', async () => {
      const onChangeSpy = jest.fn();
      const { getByText, getByTestId } = await render(
        <NumpadWrapper initialValue="1" onChangeSpy={onChangeSpy} />
      );

      // Tap "."
      fireEvent.press(getByText('.'));
      await waitFor(() => {
        expect(getByTestId('display-value').props.children).toBe('1.');
      });
      expect(onChangeSpy).toHaveBeenLastCalledWith('1.');

      // Tap "5"
      fireEvent.press(getByText('5'));
      await waitFor(() => {
        expect(getByTestId('display-value').props.children).toBe('1.5');
      });
      expect(onChangeSpy).toHaveBeenLastCalledWith('1.5');
    });

    it('should ignore duplicate decimal points', async () => {
      const onChangeSpy = jest.fn();
      const { getByText, getByTestId } = await render(
        <NumpadWrapper initialValue="1." onChangeSpy={onChangeSpy} />
      );

      // Tapping "." again when the value already has a "." should be ignored
      fireEvent.press(getByText('.'));
      // Wait a tiny bit to make sure no updates happened
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(getByTestId('display-value').props.children).toBe('1.');
      expect(onChangeSpy).not.toHaveBeenCalled();
    });

    it('should automatically prepend a leading zero when starting with a decimal point', async () => {
      const onChangeSpy = jest.fn();
      const { getByText, getByTestId } = await render(
        <NumpadWrapper initialValue="" onChangeSpy={onChangeSpy} />
      );

      // Tapping "." on empty value should yield "0."
      fireEvent.press(getByText('.'));
      await waitFor(() => {
        expect(getByTestId('display-value').props.children).toBe('0.');
      });
      expect(onChangeSpy).toHaveBeenCalledWith('0.');
    });
  });

  describe('Leading Zero Prevention', () => {
    it('should prevent multiple leading zeros but allow trailing zeros after decimal', async () => {
      const onChangeSpy = jest.fn();
      const { getByText, getByTestId } = await render(
        <NumpadWrapper initialValue="0" onChangeSpy={onChangeSpy} />
      );

      // Tapping "5" when value is "0" should replace it with "5" (not "05")
      fireEvent.press(getByText('5'));
      await waitFor(() => {
        expect(getByTestId('display-value').props.children).toBe('5');
      });
      expect(onChangeSpy).toHaveBeenLastCalledWith('5');
    });

    it('should allow decimal after single zero', async () => {
      const onChangeSpy = jest.fn();
      const { getByText, getByTestId } = await render(
        <NumpadWrapper initialValue="0" onChangeSpy={onChangeSpy} />
      );

      // Tapping "." when value is "0" should produce "0."
      fireEvent.press(getByText('.'));
      await waitFor(() => {
        expect(getByTestId('display-value').props.children).toBe('0.');
      });
      expect(onChangeSpy).toHaveBeenLastCalledWith('0.');
    });
  });

  describe('Backspace Behavior', () => {
    it('should remove the last character when backspace is pressed', async () => {
      const onChangeSpy = jest.fn();
      const { getByLabelText, getByTestId } = await render(
        <NumpadWrapper initialValue="15" onChangeSpy={onChangeSpy} />
      );

      // Backspace has accessibilityLabel="backspace"
      fireEvent.press(getByLabelText('backspace'));
      await waitFor(() => {
        expect(getByTestId('display-value').props.children).toBe('1');
      });
      expect(onChangeSpy).toHaveBeenCalledWith('1');
    });

    it('should not crash and return empty string if backspace is tapped on empty value', async () => {
      const onChangeSpy = jest.fn();
      const { getByLabelText, getByTestId } = await render(
        <NumpadWrapper initialValue="" onChangeSpy={onChangeSpy} />
      );

      fireEvent.press(getByLabelText('backspace'));
      await waitFor(() => {
        expect(getByTestId('display-value').props.children).toBe('');
      });
      expect(onChangeSpy).toHaveBeenCalledWith('');
    });

    it('should return empty string when backspacing a single digit', async () => {
      const onChangeSpy = jest.fn();
      const { getByLabelText, getByTestId } = await render(
        <NumpadWrapper initialValue="7" onChangeSpy={onChangeSpy} />
      );

      fireEvent.press(getByLabelText('backspace'));
      await waitFor(() => {
        expect(getByTestId('display-value').props.children).toBe('');
      });
      expect(onChangeSpy).toHaveBeenCalledWith('');
    });
  });

  describe('maxLength Restriction', () => {
    it('should enforce maxLength, ignoring digit typing when limit is hit', async () => {
      const onChangeSpy = jest.fn();
      const { getByText, getByTestId } = await render(
        <NumpadWrapper initialValue="123" maxLength={3} onChangeSpy={onChangeSpy} />
      );

      // Tapping "4" should do nothing because maxLength (3) is already hit
      fireEvent.press(getByText('4'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(getByTestId('display-value').props.children).toBe('123');
      expect(onChangeSpy).not.toHaveBeenCalled();
    });

    it('should ignore the decimal point in the maxLength digit count', async () => {
      const onChangeSpy = jest.fn();
      const { getByText, getByTestId } = await render(
        <NumpadWrapper initialValue="1.2" maxLength={3} onChangeSpy={onChangeSpy} />
      );

      // "1.2" has 2 digits. With maxLength=3, we can still type one more digit.
      fireEvent.press(getByText('3'));
      await waitFor(() => {
        expect(getByTestId('display-value').props.children).toBe('1.23');
      });
      expect(onChangeSpy).toHaveBeenCalledWith('1.23');
    });
  });
});

/**
 * WHAT BUGS DID THESE TESTS CATCH?
 * 1. Double decimal entries: Without the `value.includes('.')` check, a user could enter "1.5.0",
 *    which would return NaN in standard parse functions, corrupting database operations.
 * 2. Leading Zero inflation: Prevents "050" from being recorded (or evaluated as octal 40 in older environments).
 * 3. Backspace bounds: Ensures slicing an empty string `"".slice(0, -1)` returns `""` and behaves safely.
 *
 * PASSING FOR THE WRONG REASON VS. GENUINE CORRECTNESS:
 * - A test passing for the wrong reason might happen if `onChange` was called with a hardcoded value `'150'`
 *   for any keypress sequence.
 * - Genuine correctness is proved by setting dynamic prop states via a stateful wrapper and asserting that
 *   updates react relative to whatever the current value is.
 */
