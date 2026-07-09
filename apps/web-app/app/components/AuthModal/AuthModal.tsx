'use client';

import { useState } from 'react';
import { ArcaneSigil } from '../ArcaneSigil/ArcaneSigil';
import { SealLogo, Ornament } from '../ArcaneSigilLogo/ArcaneSigilLogo';
import { User } from '../../context/UserContext';
import './AuthModal.css';

interface AuthFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}

function AuthField({ label, value, onChange, placeholder, type = 'text' }: AuthFieldProps) {
  return (
    <div className="auth-modal-field">
      <label className="h-ui auth-modal-field-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="auth-modal-input"
      />
    </div>
  );
}

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: (user: User) => void;
  onSwitchMode: (mode: 'login' | 'signup') => void;
}

export function AuthModal({ mode, onClose, onSuccess, onSwitchMode }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pw) return;
    setBusy(true);
    setTimeout(() => {
      onSuccess({
        email,
        name: mode === 'signup' ? (name || email.split('@')[0]) : email.split('@')[0],
      });
    }, 900);
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-sigil">
        <ArcaneSigil size={600} intensity={0.4} />
      </div>

      <div className="auth-modal-card" onClick={e => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>×</button>

        <div className="auth-modal-header">
          <div className="auth-modal-logo">
            <SealLogo size={60} />
          </div>
          <div className="h-ui auth-modal-eyebrow">
            {mode === 'signup' ? 'Inscribe Thy Name' : 'Return to the Tome'}
          </div>
          <h2 className="h-display auth-modal-title">
            {mode === 'signup' ? 'Bind a new Seeker' : 'Welcome, Seeker'}
          </h2>
          <p className="auth-modal-sub">
            {mode === 'signup'
              ? 'Thy grimoire shall remember every incantation cast.'
              : 'Speak the words, and thy tome unlocks once more.'}
          </p>
        </div>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <AuthField label="Name" value={name} onChange={setName} placeholder="Planeswalker of choice" />
          )}
          <AuthField label="Email" value={email} onChange={setEmail} placeholder="seeker@plane.mtg" type="email" />
          <AuthField label="Password" value={pw} onChange={setPw} placeholder="••••••••" type="password" />

          <button type="submit" className="btn btn-primary auth-modal-submit" disabled={busy}>
            {busy ? 'Sealing the oath…' : (mode === 'signup' ? 'Sign up' : 'Log in')}
          </button>
        </form>

        <div className="auth-modal-switch-row">
          <button
            className="auth-modal-switch"
            onClick={() => onSwitchMode(mode === 'signup' ? 'login' : 'signup')}
          >
            {mode === 'signup' ? 'Already have an account? Return to the log in.' : 'No account yet? Sign up'}
          </button>
        </div>

        <Ornament style={{ margin: '22px 0 14px', fontSize: '0.6rem', opacity: 0.6 }}>or</Ornament>

        <button onClick={onClose} className="btn auth-modal-skip">
          Skip login
        </button>
        <p className="auth-modal-note">
          Wanderers may cast, but the tome keeps no record<br />— decks cannot be saved or exported.
        </p>
      </div>
    </div>
  );
}
