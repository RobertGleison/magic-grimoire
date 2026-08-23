import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Badge } from '../../app/components/Badge/Badge';
import { Button } from '../../app/components/Button/Button';
import { Card } from '../../app/components/Card/Card';
import { Input } from '../../app/components/Input/Input';
import { Modal } from '../../app/components/Modal/Modal';
import { Select } from '../../app/components/Select/Select';
import { Spinner } from '../../app/components/Spinner/Spinner';

afterEach(cleanup);

describe('Button', () => {
  it('renders a real <button> defaulting to type="button"', () => {
    render(<Button>Conjure</Button>);
    const button = screen.getByRole('button', { name: 'Conjure' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('btn', 'btn-primary', 'btn-md');
  });

  it('renders as a link when given href, keeping variant and size classes', () => {
    render(
      <Button href="/pricing" variant="secondary" size="lg">
        Mana Cost
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Mana Cost' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/pricing');
    expect(link).toHaveClass('btn', 'btn-secondary', 'btn-lg');
    // An anchor must not sprout button-only attributes.
    expect(link).not.toHaveAttribute('type');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('marks a disabled link inert with ARIA rather than the disabled attribute', () => {
    render(
      <Button href="/library" disabled>
        Library
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Library' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
  });

  it('passes disabled through to the native button and blocks clicks', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Forge
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Forge' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('passes native button attributes and handlers straight through', () => {
    const onClick = vi.fn();
    render(
      <Button type="submit" onClick={onClick} aria-label="Submit the ritual" form="ritual">
        Submit
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Submit the ritual' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('form', 'ritual');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables itself and exposes aria-busy plus a spinner while loading', () => {
    render(<Button loading>Compiling</Button>);
    const button = screen.getByRole('button', { name: /Compiling/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.spinner')).not.toBeNull();
  });

  it('does not render a spinner when idle', () => {
    render(<Button>Idle</Button>);
    expect(screen.getByRole('button').querySelector('.spinner')).toBeNull();
  });
});

describe('Input', () => {
  it('binds a generated id to a real <label>', () => {
    render(<Input label="Aether Mail" placeholder="liliana@mana.vault" />);
    const input = screen.getByLabelText('Aether Mail');
    expect(input.tagName).toBe('INPUT');
    expect(input.id).toBeTruthy();

    const label = document.querySelector('label');
    expect(label).not.toBeNull();
    expect(label).toHaveAttribute('for', input.id);
    expect(input).toHaveAttribute('placeholder', 'liliana@mana.vault');
  });

  it('honours a caller-supplied id instead of generating one', () => {
    render(<Input id="handle" label="Planeswalker Handle" />);
    expect(screen.getByLabelText('Planeswalker Handle')).toHaveAttribute('id', 'handle');
  });

  it('wires error text through aria-invalid and aria-describedby', () => {
    render(<Input id="pw" label="Spell-Password" error="Too few runes" />);
    const input = screen.getByLabelText('Spell-Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent('Too few runes');
    expect(message).toHaveAttribute('id', 'pw-error');
    expect(input).toHaveAttribute('aria-describedby', 'pw-error');
  });

  it('joins hint and error ids, preserving any caller-supplied describedby', () => {
    render(
      <Input
        id="email"
        label="Aether Mail"
        hint="We never sell your scrolls."
        error="Not a valid address"
        aria-describedby="outside"
      />,
    );
    expect(screen.getByLabelText('Aether Mail')).toHaveAttribute(
      'aria-describedby',
      'outside email-error email-hint',
    );
  });

  it('omits aria-invalid and the alert when there is no error', () => {
    render(<Input id="clean" label="Handle" />);
    const input = screen.getByLabelText('Handle');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('passes type and disabled through', () => {
    render(<Input id="pw2" label="Spell-Password" type="password" disabled />);
    const input = screen.getByLabelText('Spell-Password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toBeDisabled();
  });
});

describe('Select', () => {
  const formats = [
    { value: 'standard', label: 'Standard' },
    { value: 'modern', label: 'Modern' },
    { value: 'commander', label: 'Commander' },
  ];

  it('renders a native select bound to its label, with a placeholder option', () => {
    render(<Select label="Spell Format" options={formats} placeholder="Choose a format" />);
    const select = screen.getByLabelText('Spell Format');
    expect(select.tagName).toBe('SELECT');
    expect(document.querySelector('label')).toHaveAttribute('for', select.id);
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByRole('option', { name: 'Choose a format' })).toBeDisabled();
  });

  it('applies the same error contract as Input', () => {
    render(<Select id="fmt" label="Spell Format" options={formats} error="Pick a format" />);
    const select = screen.getByLabelText('Spell Format');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', 'fmt-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a format');
  });

  it('reports changes and passes disabled through', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Select label="Spell Format" options={formats} defaultValue="standard" onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText('Spell Format'), { target: { value: 'modern' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText<HTMLSelectElement>('Spell Format').value).toBe('modern');

    rerender(<Select label="Spell Format" options={formats} disabled />);
    expect(screen.getByLabelText('Spell Format')).toBeDisabled();
  });

  it('prefers explicit children over the options prop', () => {
    render(
      <Select label="Spell Format" options={formats}>
        <option value="pauper">Pauper</option>
      </Select>,
    );
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Pauper' })).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('renders the requested element with surface, elevation and border classes', () => {
    render(
      <Card as="article" variant="inset" elevation={3} border="thick" radius="xl" padding="xl">
        Apprentice Pack
      </Card>,
    );
    const card = screen.getByText('Apprentice Pack');
    expect(card.tagName).toBe('ARTICLE');
    expect(card).toHaveClass(
      'card',
      'card-inset',
      'card-elev-3',
      'card-border-thick',
      'card-radius-xl',
      'card-pad-xl',
    );
  });

  it('defaults to a flat panel div and merges extra classes', () => {
    render(<Card className="pricing-tier">Tier</Card>);
    const card = screen.getByText('Tier');
    expect(card.tagName).toBe('DIV');
    expect(card).toHaveClass('card-panel', 'card-elev-0', 'card-radius-lg', 'pricing-tier');
    expect(card).not.toHaveClass('card-interactive');
  });

  it('exposes every elevation rung the token ladder defines', () => {
    ([0, 1, 2, 3, 4] as const).forEach((elevation) => {
      const { unmount } = render(<Card elevation={elevation}>{`e${elevation}`}</Card>);
      expect(screen.getByText(`e${elevation}`)).toHaveClass(`card-elev-${elevation}`);
      unmount();
    });
  });

  it('adds the hover-lift class only when interactive', () => {
    render(<Card interactive>Deck</Card>);
    expect(screen.getByText('Deck')).toHaveClass('card-interactive');
  });
});

describe('Badge', () => {
  it('renders the harvested crimson pill', () => {
    render(
      <Badge variant="crimson" size="md" shape="pill">
        MTG AI Core v2.0 Live
      </Badge>,
    );
    const badge = screen.getByText('MTG AI Core v2.0 Live');
    expect(badge).toHaveClass('badge', 'badge-crimson', 'badge-md', 'badge-pill');
  });

  it('covers every deck status', () => {
    (['pending', 'processing', 'completed', 'failed'] as const).forEach((status) => {
      const { unmount } = render(<Badge variant={status}>{status}</Badge>);
      expect(screen.getByText(status)).toHaveClass(`badge-${status}`);
      unmount();
    });
  });

  it('covers every deck category', () => {
    (['creature', 'spell', 'land'] as const).forEach((category) => {
      const { unmount } = render(<Badge variant={category}>{category}</Badge>);
      expect(screen.getByText(category)).toHaveClass(`badge-${category}`);
      unmount();
    });
  });

  it('hides a decorative icon from assistive tech', () => {
    render(<Badge icon={<span>*</span>}>Live</Badge>);
    const icon = screen.getByText('Live').querySelector('.badge-icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Spinner', () => {
  it('announces itself as a status with an accessible label', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('spinner', 'spinner-md');
    expect(spinner).toHaveTextContent('Loading');
  });

  it('drops the label when the caller owns the loading semantics', () => {
    render(<Spinner size="xs" label="" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('spinner-xs');
    expect(spinner).toHaveTextContent('');
  });
});

function ModalHarness({ closeOnScrimClick = true }: { closeOnScrimClick?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Dissolve deck
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Dissolve this deck?"
        description="This unmakes the deck permanently."
        closeOnScrimClick={closeOnScrimClick}
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            Confirm
          </button>
        }
      >
        <input aria-label="Reason" />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<ModalHarness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled, described, modal dialog portalled to the body', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve deck' }));

    const dialog = screen.getByRole('dialog', { name: 'Dissolve this deck?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('This unmakes the deck permanently.');
    // Portalled: its ancestor chain reaches body without passing the trigger.
    expect(dialog.closest('.modal-scrim')?.parentElement).toBe(document.body);
  });

  it('locks the page behind it and unlocks on close', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve deck' }));
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('moves focus inside on open and restores it to the trigger on close', () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Dissolve deck' });
    // fireEvent.click does not focus its target the way a real pointer press
    // does, so focus the trigger first — that is the state Modal must restore.
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close dialog' }));

    fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab inside the dialog in both directions', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve deck' }));

    const close = screen.getByRole('button', { name: 'Close dialog' });
    const reason = screen.getByLabelText('Reason');
    const confirm = screen.getByRole('button', { name: 'Confirm' });

    // Forwards off the last control wraps to the first.
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    // Backwards off the first control wraps to the last.
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    // Interior moves are left to the browser.
    reason.focus();
    fireEvent.keyDown(reason, { key: 'Tab' });
    expect(document.activeElement).toBe(reason);
  });

  it('closes on a scrim click but not on a click inside the dialog', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve deck' }));

    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('modal-scrim'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores scrim clicks when closeOnScrimClick is false', () => {
    render(<ModalHarness closeOnScrimClick={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve deck' }));

    fireEvent.click(screen.getByTestId('modal-scrim'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes from its own close button', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve deck' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
