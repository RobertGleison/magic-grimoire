'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { getSupabase } from '../lib/supabase';
import {
  AuthDivider,
  AuthHeading,
  AuthScaffold,
  AuthSwitch,
  FormAlert,
  SocialAuthRow,
} from './AuthScaffold';
import {
  authHref,
  describeAuthError,
  isSupabaseConfigured,
  oauthRedirectTo,
  resolveNextPath,
  SUPABASE_CONFIG_ERROR,
  validateEmail,
  validatePassword,
  type AuthProvider,
} from './authShared';
import styles from './page.module.css';

/**
 * `/login` — Figma page 16:407, card 16:410 (480x663 dark, canonical).
 *
 * Split out of `page.tsx` so the page itself can stay a server component and
 * wrap this in `<Suspense>`; `useSearchParams` in a client page would
 * otherwise fail the static prerender during `next build`.
 *
 * The password only ever lives in this component's local state and is cleared
 * on success. It is never logged, persisted, or put in a URL.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get('next') ?? null;
  const destination = resolveNextPath(nextParam);
  const titleId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<AuthProvider | null>(null);

  const configured = isSupabaseConfigured();
  const locked = busy || oauthBusy !== null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const errors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setFormError(describeAuthError(error));
        return;
      }
      setPassword('');
      router.replace(destination);
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  const startOAuth = async (provider: AuthProvider) => {
    setFormError(null);
    setNotice(null);
    setOauthBusy(provider);
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo: oauthRedirectTo(nextParam) },
      });
      // On success the browser leaves for the provider; only errors land here.
      if (error) {
        setFormError(describeAuthError(error));
        setOauthBusy(null);
      }
    } catch (error) {
      setFormError(describeAuthError(error));
      setOauthBusy(null);
    }
  };

  /** Design node 16:428. Uses whatever is already typed in the email field. */
  const handleForgotPassword = async () => {
    setFormError(null);
    setNotice(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setFieldErrors((current) => ({ ...current, email: emailError }));
      return;
    }

    setBusy(true);
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: oauthRedirectTo('/login'),
      });
      if (error) {
        setFormError(describeAuthError(error));
        return;
      }
      setNotice('If that address has an account, a reset link is on its way.');
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScaffold>
      <AuthHeading
        titleId={titleId}
        title="Enter the Grimoire"
        subtitle="Welcome back, wizard. Enter your key to access your archives."
      />

      {configured ? (
        <>
          <form className={styles.form} onSubmit={handleSubmit} aria-labelledby={titleId} noValidate>
            <div className={styles.fields}>
              <Input
                label="Aether Mail (Email)"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="liliana@mana.vault"
                value={email}
                error={fieldErrors.email}
                disabled={locked}
                required
                onChange={(event) => setEmail(event.target.value)}
              />

              <div className={styles.passwordGroup}>
                <Input
                  label="Spell-Password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  error={fieldErrors.password}
                  disabled={locked}
                  required
                  onChange={(event) => setPassword(event.target.value)}
                />
                <div className={styles.passwordMeta}>
                  <span className={styles.secureNote}>Secure Connection Active</span>
                  <button
                    type="button"
                    className={styles.forgotLink}
                    disabled={locked}
                    onClick={handleForgotPassword}
                  >
                    Forgot Spell-Password?
                  </button>
                </div>
              </div>
            </div>

            {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
            {notice ? <FormAlert tone="notice">{notice}</FormAlert> : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              className={styles.submit}
              loading={busy}
              disabled={oauthBusy !== null}
            >
              Sign In
            </Button>
          </form>

          <AuthDivider label="Or Connect With" />

          <SocialAuthRow
            actionVerb="continue with"
            busyProvider={oauthBusy}
            disabled={busy}
            onSelect={startOAuth}
          />
        </>
      ) : (
        <FormAlert tone="error">{SUPABASE_CONFIG_ERROR}</FormAlert>
      )}

      <AuthSwitch
        prompt="New to Magic Grimoire?"
        href={authHref('/signup', nextParam)}
        label="Create an account"
      />
    </AuthScaffold>
  );
}
