'use client';

import { useState } from 'react';
import { ArcaneSigil } from './ArcaneSigil';
import { SealLogo } from './atoms';
import { User } from '../context/UserContext';

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: (user: User) => void;
  onSwitchMode: (mode: 'login' | 'signup') => void;
}

function AuthField({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="h-ui" style={{ fontSize: '0.6rem', opacity: 0.7, display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'var(--void-0)',
          border: '1px solid rgba(var(--accent-glow), 0.2)',
          color: 'var(--cream)',
          fontFamily: 'var(--font-body)',
          fontSize: '1rem',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => (e.target.style.borderColor = 'rgba(var(--accent-glow), 0.5)')}
        onBlur={e => (e.target.style.borderColor = 'rgba(var(--accent-glow), 0.2)')}
      />
    </div>
  );
}

export default function AuthModal({ mode, onClose, onSuccess, onSwitchMode }: AuthModalProps) {
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

  const cornerPos = [[0, 0], [0, 1], [1, 0], [1, 1]] as const;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(8,6,10,0.85), rgba(8,6,10,0.98))',
        backdropFilter: 'blur(6px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'messageIn 0.4s ease',
      }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.15, pointerEvents: 'none' }}>
        <ArcaneSigil size={600} intensity={0.4} />
      </div>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          background: 'linear-gradient(180deg, var(--void-2), var(--void-0))',
          border: '1px solid rgba(var(--accent-glow), 0.4)',
          padding: '36px 32px',
          boxShadow: '0 0 60px rgba(var(--accent-glow), 0.2), 0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        {cornerPos.map(([r, c], i) => (
          <span key={i} style={{
            position: 'absolute',
            [r ? 'bottom' : 'top']: -1,
            [c ? 'right' : 'left']: -1,
            width: 14, height: 14,
            [r ? 'borderBottom' : 'borderTop']: '1px solid var(--accent)',
            [c ? 'borderRight' : 'borderLeft']: '1px solid var(--accent)',
          }} />
        ))}

        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 14, background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.3rem' }}
        >
          ×
        </button>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="seal" style={{ margin: '0 auto 18px', width: 56, height: 56 }}>
            <SealLogo size={32} />
          </div>
          <div className="h-ui" style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 8 }}>
            {mode === 'signup' ? 'Inscribe Thy Name' : 'Return to the Tome'}
          </div>
          <h2 className="h-display" style={{ fontSize: '1.6rem', margin: 0, fontStyle: 'italic', color: 'var(--cream)' }}>
            {mode === 'signup' ? 'Bind a new Seeker' : 'Welcome, Seeker'}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', fontStyle: 'italic', color: 'var(--cream)', opacity: 0.65, margin: '10px 0 0' }}>
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

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', marginTop: 12, fontSize: '0.8rem', padding: '14px 24px', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Sealing the oath…' : (mode === 'signup' ? 'Sign up' : 'Log in')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <button
            onClick={() => onSwitchMode(mode === 'signup' ? 'login' : 'signup')}
            style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '0.92rem' }}
          >
            {mode === 'signup' ? 'Already have an account? Return to the log in.' : 'No account yet? Sign up'}
          </button>
        </div>

        <div style={{ margin: '22px 0 14px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)' }}>
          <span style={{ flex: 1, height: 1, background: 'rgba(var(--accent-glow), 0.15)' }} />
          <span className="h-ui" style={{ fontSize: '0.6rem', opacity: 0.6 }}>or</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(var(--accent-glow), 0.15)' }} />
        </div>

        <button onClick={onClose} className="btn" style={{ width: '100%', fontSize: '0.72rem' }}>
          Skip login
        </button>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--muted)', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.45 }}>
          Wanderers may cast, but the tome keeps no record<br />— decks cannot be saved or exported.
        </p>
      </div>
    </div>
  );
}
