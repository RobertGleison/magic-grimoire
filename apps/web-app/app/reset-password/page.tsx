'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { ArcaneSigil } from '../components/ArcaneSigil/ArcaneSigil';
import { SealLogo } from '../components/ArcaneSigilLogo/ArcaneSigilLogo';
import style from './page.module.css';

type View = 'form' | 'success' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('form');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setView('form');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setView('invalid');
    });

    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (err) { setError(err.message); return; }
    setView('success');
    setTimeout(() => router.push('/'), 2500);
  };

  const cornerPos = [[0, 0], [0, 1], [1, 0], [1, 1]] as const;

  return (
    <div className={style.page}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.1, pointerEvents: 'none' }}>
        <ArcaneSigil size={600} intensity={0.3} />
      </div>

      <div className={style.card}>
        {cornerPos.map(([r, c], i) => (
          <span key={i} className={style.corner} style={{
            [r ? 'bottom' : 'top']: -1,
            [c ? 'right' : 'left']: -1,
            [r ? 'borderBottom' : 'borderTop']: '1px solid var(--accent)',
            [c ? 'borderRight' : 'borderLeft']: '1px solid var(--accent)',
          }} />
        ))}

        <div className={style.header}>
          <SealLogo size={56} />
          <div className="h-ui" style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 6 }}>
            {view === 'success' ? 'Oath Rebound' : view === 'invalid' ? 'Link Expired' : 'Reforge Thy Oath'}
          </div>
          <h2 className="h-display" style={{ fontSize: '1.5rem', margin: 0, fontStyle: 'italic', color: 'var(--cream)' }}>
            {view === 'success' ? 'Password updated' : view === 'invalid' ? 'Invalid link' : 'Set new password'}
          </h2>
        </div>

        {view === 'success' && (
          <p className={style.body}>
            Thy new oath is sealed. Redirecting thee to the home…
          </p>
        )}

        {view === 'invalid' && (
          <>
            <p className={style.body}>
              This link has expired or is invalid. Request a new one from the login page.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem', padding: '14px 24px' }} onClick={() => router.push('/')}>
              Return home
            </button>
          </>
        )}

        {view === 'form' && (
          <form onSubmit={submit}>
            <div className={style.field}>
              <label className="h-ui" style={{ fontSize: '0.6rem', opacity: 0.7, display: 'block', marginBottom: 6 }}>New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={style.input}
              />
            </div>
            <div className={style.field}>
              <label className="h-ui" style={{ fontSize: '0.6rem', opacity: 0.7, display: 'block', marginBottom: 6 }}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                className={style.input}
              />
            </div>

            {error && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#e57373', margin: '0 0 10px', textAlign: 'center' }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', marginTop: 12, fontSize: '0.8rem', padding: '14px 24px', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Sealing…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
