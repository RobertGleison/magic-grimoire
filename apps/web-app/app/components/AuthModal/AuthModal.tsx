'use client';

import { useState } from 'react';
import { ArcaneSigil } from '../ArcaneSigil/ArcaneSigil';
import { SealLogo } from '../ArcaneSigilLogo/ArcaneSigilLogo';
import { supabase } from '../../../lib/supabase';

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: () => void;
  onSwitchMode: (mode: 'login' | 'signup') => void;
}

type View = 'form' | 'forgot' | 'forgot-sent';

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
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('form');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pw) return;
    setBusy(true);
    setError(null);

    if (mode === 'signup') {
      const { error: err } = await supabase.auth.signUp({
        email,
        password: pw,
        options: { data: { full_name: name || email.split('@')[0] } },
      });
      if (err) { setError(err.message); setBusy(false); return; }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (err) { setError(err.message); setBusy(false); return; }
    }

    setBusy(false);
    onSuccess();
  };

  const sendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setView('forgot-sent');
  };

  const signInWithOAuth = (provider: 'google' | 'github') => {
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
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
          <SealLogo size={60} />
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

        {view === 'forgot-sent' ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--cream)', marginBottom: 8 }}>
              Check thy inbox — a reset link has been dispatched.
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--muted)', fontStyle: 'italic' }}>
              {email}
            </p>
            <button
              onClick={() => setView('form')}
              style={{ marginTop: 18, background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '0.92rem' }}
            >
              ← Back to log in
            </button>
          </div>
        ) : view === 'forgot' ? (
          <form onSubmit={sendResetEmail}>
            <AuthField label="Email" value={email} onChange={setEmail} placeholder="seeker@plane.mtg" type="email" />
            {error && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#e57373', margin: '0 0 10px', textAlign: 'center' }}>
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', marginTop: 12, fontSize: '0.8rem', padding: '14px 24px', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setView('form')}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '0.92rem' }}
              >
                ← Back to log in
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={submit}>
              {mode === 'signup' && (
                <AuthField label="Name" value={name} onChange={setName} placeholder="Planeswalker of choice" />
              )}
              <AuthField label="Email" value={email} onChange={setEmail} placeholder="seeker@plane.mtg" type="email" />
              <AuthField label="Password" value={pw} onChange={setPw} placeholder="••••••••" type="password" />

              {error && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#e57373', margin: '0 0 10px', textAlign: 'center' }}>
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', marginTop: 12, fontSize: '0.8rem', padding: '14px 24px', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Sealing the oath…' : (mode === 'signup' ? 'Sign up' : 'Log in')}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => onSwitchMode(mode === 'signup' ? 'login' : 'signup')}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '0.92rem' }}
              >
                {mode === 'signup' ? 'Already have an account? Return to the log in.' : 'No account yet? Sign up'}
              </button>
              {mode === 'login' && (
                <button
                  onClick={() => { setView('forgot'); setError(null); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '0.92rem' }}
                >
                  Forgot password?
                </button>
              )}
            </div>
          </>
        )}

        <div style={{ margin: '22px 0 14px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)' }}>
          <span style={{ flex: 1, height: 1, background: 'rgba(var(--accent-glow), 0.15)' }} />
          <span className="h-ui" style={{ fontSize: '0.6rem', opacity: 0.6 }}>or</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(var(--accent-glow), 0.15)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => signInWithOAuth('google')}
            className="btn"
            style={{ width: '100%', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            onClick={() => signInWithOAuth('github')}
            className="btn"
            style={{ width: '100%', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <GitHubIcon />
            Continue with GitHub
          </button>
          <button onClick={onClose} className="btn" style={{ width: '100%', fontSize: '0.72rem' }}>
            Skip login
          </button>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--muted)', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.45 }}>
          Wanderers may cast, but the tome keeps no record<br />— decks cannot be saved or exported.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 35 24 35c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.0 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 35c-5.311 0-9.82-3.322-11.542-8H6.204A19.946 19.946 0 0024 44z" fill="#4CAF50"/>
      <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}
