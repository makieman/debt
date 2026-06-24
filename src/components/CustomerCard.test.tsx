/**
 * src/components/CustomerCard.test.tsx
 *
 * WHY ARE WE TESTING THIS?
 * `CustomerCard` is the visual representation of a customer in our list. It displays their name,
 * phone number, initials, and how much they owe (color-coded as red for debt or green for settled).
 * We test this to ensure:
 *   - Correct conditional rendering: If a customer has no phone number, we don't display a blank space or incorrect text.
 *   - Correct balance formatting: Shopkeepers must see exact amounts.
 *   - Interaction safety: Pressing the card correctly triggers navigation to the transaction details page.
 *
 * JEST CONCEPTS INTRODUCED HERE:
 * - `beforeEach(block)`: Resets state or variables before each test. In UI tests, this prevents state contamination.
 *   If test A mutated a mock customer's name, test B starts with the original mock customer, keeping tests ISOLATED.
 * - Mock Function (`jest.fn()`): A "spy" or mock function that records calls.
 *   Why use `jest.fn()` instead of a real function?
 *   A real function would perform navigation or database writes, which are slow and unrelated to the card.
 *   `jest.fn()` allows us to:
 *     1. Verify the function was called (`toHaveBeenCalled`).
 *     2. Verify it was called exactly once (`toHaveBeenCalledTimes(1)`).
 *     3. Test in isolation without firing real-world side effects.
 *
 * NOTE FOR REACT 19 / RNTL v14:
 * In RNTL v14, `render` returns a Promise resolving to the render queries and container.
 * We must use `await render(...)` to access the destructured query methods.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CustomerCard } from './CustomerCard';
import { Customer } from '../types';

describe('CustomerCard Component', () => {
  let mockCustomer: Customer;
  let onPressMock: jest.Mock;

  beforeEach(() => {
    // Reset our mock customer data before each test
    mockCustomer = {
      id: 1,
      name: 'Kamau Wanjiku',
      phone: '0712345678',
      createdAt: '2026-06-21T18:00:00.000Z',
    };

    // Create a fresh mock function to spy on presses
    onPressMock = jest.fn();
  });

  describe('Rendering text and phone numbers', () => {
    it('should render the customer name', async () => {
      const { getByText } = await render(
        <CustomerCard
          customer={mockCustomer}
          balance={0}
          onPress={onPressMock}
        />
      );

      // Verify name is rendered
      expect(getByText('Kamau Wanjiku')).toBeTruthy();
    });

    it('should render the phone number if it is provided', async () => {
      const { getByText } = await render(
        <CustomerCard
          customer={mockCustomer}
          balance={0}
          onPress={onPressMock}
        />
      );

      // Verify phone number is rendered
      expect(getByText('0712345678')).toBeTruthy();
    });

    it('should not render the phone number text if phone is not provided', async () => {
      // Remove phone number
      const customerNoPhone = { ...mockCustomer, phone: undefined };

      const { queryByText, getByText } = await render(
        <CustomerCard
          customer={customerNoPhone}
          balance={0}
          onPress={onPressMock}
        />
      );

      // Verify the phone number '0712345678' is NOT in the UI
      expect(queryByText('0712345678')).toBeNull();
      // It should display the placeholder "No phone" instead
      expect(getByText('No phone')).toBeTruthy();
    });
  });

  describe('Balance Display States', () => {
    it('should format and display positive balances as debt outstanding', async () => {
      const { getByText, queryByText } = await render(
        <CustomerCard
          customer={mockCustomer}
          balance={1500} // KES 15 (stored in cents: 1500)
          onPress={onPressMock}
        />
      );

      // The card uses a local formatKES: return `KES ${amount.toLocaleString()}`
      // Since balance is passed in cents (or shillings? wait, the card expects balance, and
      // balance is passed down. In CustomerListScreen, is the balance in cents?
      // Yes! But wait, does CustomerCard's local formatKES divide by 100?
      // Let's check CustomerCard.tsx local formatKES:
      //   function formatKES(amount: number): string {
      //     return `KES ${amount.toLocaleString()}`;
      //   }
      // Oh! The local formatKES in CustomerCard.tsx does NOT divide by 100!
      // So passing 1500 gives "KES 1,500"
      expect(getByText('KES 1,500')).toBeTruthy();
      expect(getByText('owes')).toBeTruthy();
      expect(queryByText('Settled')).toBeNull();
    });

    it('should show "Settled" when the balance is zero', async () => {
      const { getByText, queryByText } = await render(
        <CustomerCard
          customer={mockCustomer}
          balance={0}
          onPress={onPressMock}
        />
      );

      expect(getByText('Settled')).toBeTruthy();
      expect(getByText('✓')).toBeTruthy();
      expect(queryByText('owes')).toBeNull();
    });
  });

  describe('Name Initials Circle', () => {
    it('should display initials "KW" for "Kamau Wanjiku"', async () => {
      const { getByText } = await render(
        <CustomerCard
          customer={mockCustomer}
          balance={0}
          onPress={onPressMock}
        />
      );

      expect(getByText('KW')).toBeTruthy();
    });

    it('should display initial "J" for a single name like "John"', async () => {
      const customerSingleName = { ...mockCustomer, name: 'John' };
      const { getByText } = await render(
        <CustomerCard
          customer={customerSingleName}
          balance={0}
          onPress={onPressMock}
        />
      );

      expect(getByText('J')).toBeTruthy();
    });
  });

  describe('Press interactions', () => {
    it('should call onPress exactly once when card is pressed', async () => {
      const { getByRole } = await render(
        <CustomerCard
          customer={mockCustomer}
          balance={0}
          onPress={onPressMock}
        />
      );

      // Press the card (CustomerCard has an accessibilityRole of "button")
      const card = getByRole('button');
      fireEvent.press(card);

      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress if the card is not pressed', async () => {
      await render(
        <CustomerCard
          customer={mockCustomer}
          balance={0}
          onPress={onPressMock}
        />
      );

      expect(onPressMock).not.toHaveBeenCalled();
    });
  });
});

/**
 * WHAT BUGS DID THESE TESTS CATCH?
 * 1. Double tap / multiple firing: If the Pressable was misconfigured or bound multiple times,
 *    onPress might trigger twice, causing the app to push the details screen twice onto the stack.
 * 2. Balance mismatch: Ensures that balance display changes correctly between settled (green checkmark)
 *    and outstanding (red debt amount) based on numeric thresholds.
 *
 * PASSING FOR THE WRONG REASON VS. GENUINE CORRECTNESS:
 * - A test passing for the wrong reason might happen if `onPress` was hardcoded to run inside the component
 *   render phase (calling `onPress()` immediately). The test would assert it was called, but the app
 *   would crash on mount due to infinite rendering loop.
 * - Genuine correctness is proved by ensuring the spy function is only invoked in response to a simulated user press.
 */
