import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OptionsPanel } from '../../app/components/OptionsPanel/OptionsPanel';

function baseProps(overrides = {}) {
  return {
    format: 'Modern',
    setFormat: vi.fn(),
    colors: [],
    toggleColor: vi.fn(),
    deckSize: 60,
    setDeckSize: vi.fn(),
    onClearChat: vi.fn(),
    disableClear: false,
    ...overrides,
  };
}

describe('OptionsPanel — clear chat', () => {
  it('shows a Clear chat button', () => {
    render(<OptionsPanel {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Clear chat' })).toBeInTheDocument();
  });

  it('calls onClearChat when clicked', () => {
    const onClearChat = vi.fn();
    render(<OptionsPanel {...baseProps({ onClearChat })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }));
    expect(onClearChat).toHaveBeenCalledOnce();
  });

  it('disables the button when disableClear is true', () => {
    render(<OptionsPanel {...baseProps({ disableClear: true })} />);
    expect(screen.getByRole('button', { name: 'Clear chat' })).toBeDisabled();
  });

  it('does not call onClearChat when disabled and clicked', () => {
    const onClearChat = vi.fn();
    render(<OptionsPanel {...baseProps({ onClearChat, disableClear: true })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }));
    expect(onClearChat).not.toHaveBeenCalled();
  });
});
