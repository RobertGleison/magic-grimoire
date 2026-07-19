'use client';

import { useState } from 'react';
import { SealLogo, Ornament } from '../ArcaneSigilLogo/ArcaneSigilLogo';
import { supabase } from '../../lib/supabase';
import './AuthModal.css';

type OAuthProvider = 'google' | 'github';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 013.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const OAUTH_PROVIDERS: { id: OAuthProvider; label: string; icon: React.ReactNode }[] = [
  { id: 'google', label: 'Continue with Google', icon: <GoogleIcon /> },
  { id: 'github', label: 'Continue with GitHub', icon: <GitHubIcon /> },
];

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
  onSwitchMode: (mode: 'login' | 'signup') => void;
}

export function AuthModal({ mode, onClose, onSwitchMode }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pw) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: { data: { name: name || email.split('@')[0] } },
      });
      setBusy(false);
      if (error) { setError(error.message); return; }
      if (!data.session) {
        setNotice('Check your email to confirm your account, then log in.');
        return;
      }
      onClose();
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      setBusy(false);
      if (error) { setError(error.message); return; }
      onClose();
    }
  };

  const oauth = async (provider: OAuthProvider) => {
    setOauthBusy(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.href },
    });
    // On success the browser navigates away; only errors land here.
    if (error) {
      setOauthBusy(null);
      setError(error.message);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>
          ×
        </button>

        <div className="auth-modal-header">
          <div className="auth-modal-logo">
            <SealLogo size={60} />
          </div>
          <h2 className="h-display auth-modal-title">
            {mode === "signup" ? "Create your account" : "Welcome planeswalker"}
          </h2>
        </div>

        <div className="auth-modal-oauth-row">
          {OAUTH_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className="btn auth-modal-oauth-btn"
              disabled={busy || oauthBusy !== null}
              onClick={() => oauth(provider.id)}
            >
              {provider.icon}
              <span>
                {oauthBusy === provider.id ? "Connecting…" : provider.label}
              </span>
            </button>
          ))}
        </div>

        <Ornament
          style={{ margin: "22px 0 14px", fontSize: "0.6rem", opacity: 0.6 }}
        >
          or
        </Ornament>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <AuthField
              label="Username"
              value={name}
              onChange={setName}
              placeholder="Username"
            />
          )}
          <AuthField
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="username@gmail.com"
            type="email"
          />
          <AuthField
            label="Password"
            value={pw}
            onChange={setPw}
            placeholder="••••••••"
            type="password"
          />

          {error && <p className="auth-modal-error">{error}</p>}
          {notice && <p className="auth-modal-notice">{notice}</p>}

          <button
            type="submit"
            className="btn btn-primary auth-modal-submit"
            disabled={busy || oauthBusy !== null}
          >
            {busy
              ? "Sealing the oath…"
              : mode === "signup"
              ? "Sign up"
              : "Log in"}
          </button>
        </form>

        <div className="auth-modal-switch-row">
          <button
            className="auth-modal-switch"
            onClick={() => onSwitchMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup"
              ? "Already have an account? Return to the log in."
              : "No account yet? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
