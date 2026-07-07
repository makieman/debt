import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Switch } from './Switch';

// Mock our custom ThemeContext since the Switch uses useThemeContext
jest.mock('../../theme', () => ({
  useThemeContext: () => ({
    colors: {
      background: {
        tertiary: '#E5E7EB',
      },
      accent: {
        teal: '#10B981',
      },
    },
  }),
}));

describe('Switch Component', () => {
  it('renders without crashing', async () => {
    const { getByRole } = await render(
      <Switch value={false} onValueChange={() => {}} />
    );
    const switchEl = getByRole('switch');
    expect(switchEl).toBeTruthy();
  });

  it('reflects checked state correctly via accessibilityState when value=false', async () => {
    const { getByRole } = await render(
      <Switch value={false} onValueChange={() => {}} />
    );
    const switchEl = getByRole('switch');
    expect(switchEl.props.accessibilityState.checked).toBe(false);
  });

  it('reflects checked state correctly via accessibilityState when value=true', async () => {
    const { getByRole } = await render(
      <Switch value={true} onValueChange={() => {}} />
    );
    const switchEl = getByRole('switch');
    expect(switchEl.props.accessibilityState.checked).toBe(true);
  });

  it('calls onValueChange(true) when pressed and value=false', async () => {
    const mockOnValueChange = jest.fn();
    const { getByRole } = await render(
      <Switch value={false} onValueChange={mockOnValueChange} />
    );
    const switchEl = getByRole('switch');

    fireEvent.press(switchEl);
    expect(mockOnValueChange).toHaveBeenCalledTimes(1);
    expect(mockOnValueChange).toHaveBeenCalledWith(true);
  });

  it('calls onValueChange(false) when pressed and value=true', async () => {
    const mockOnValueChange = jest.fn();
    const { getByRole } = await render(
      <Switch value={true} onValueChange={mockOnValueChange} />
    );
    const switchEl = getByRole('switch');

    fireEvent.press(switchEl);
    expect(mockOnValueChange).toHaveBeenCalledTimes(1);
    expect(mockOnValueChange).toHaveBeenCalledWith(false);
  });

  it('does NOT call onValueChange when pressed and disabled=true', async () => {
    const mockOnValueChange = jest.fn();
    const { getByRole } = await render(
      <Switch value={false} onValueChange={mockOnValueChange} disabled={true} />
    );
    const switchEl = getByRole('switch');

    fireEvent.press(switchEl);
    expect(mockOnValueChange).not.toHaveBeenCalled();
  });

  it('applies disabled styling and accessibilityState when disabled=true', async () => {
    const { getByRole } = await render(
      <Switch value={false} onValueChange={() => {}} disabled={true} />
    );
    const switchEl = getByRole('switch');
    expect(switchEl.props.accessibilityState.disabled).toBe(true);
  });
});
