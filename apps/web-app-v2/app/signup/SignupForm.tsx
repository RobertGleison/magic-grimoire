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
} from '../login/AuthScaffold';
import {
  authHref,
  describeAuthError,
  isSupabaseConfigured,
  oauthRedirectTo,
  resolveNextPath,
  SUPABASE_CONFIG_ERROR,
  validateEmail,
  validateHandle,
  validatePassword,
  type AuthProvider,
} from '../login/authShared';
import styles from './page.module.css';

/**
 * `/signup` — Figma page 16:364, card 16:367 (480x813 dark, canonical).
 *
 * Shares its chrome with `/login`; the wave-3 rule keeps those sub-components
 * page-local, so they are imported from `app/login/` with a full relative
 * path rather than promoted to `app/components/`.
 *
 * Passwords live only in this component's local state and are cleared as soon
 * as Supabase has them. Nothing is logged.
 */
export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get('next') ?? null;
  const destination = resolveNextPath(nextParam);
  const titleId = useId();

  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    handle?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
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
      handle: validateHandle(handle),
      email: validateEmail(email),
      password: validatePassword(password, { requireStrong: true }),
      confirmPassword: confirmPassword === password ? undefined : 'The two spells do not match.',
    };
    setFieldErrors(errors);
    if (errors.handle || errors.email || errors.password || errors.confirmPassword) return;

    setBusy(true);
    try {
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: handle.trim() },
          emailRedirectTo: oauthRedirectTo(nextParam),
        },
      });
      if (error) {
        setFormError(describeAuthError(error));
        return;
      }

      setPassword('');
      setConfirmPassword('');

      // No session means the project has email confirmation switched on.
      if (!data.session) {
        setNotice('Check your inbox to confirm your account, then sign in.');
        return;
      }
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

  return (
    <AuthScaffold>
      <AuthHeading
        titleId={titleId}
        title="Create Your Grimoire"
        subtitle="Forge an account to summon unlimited deck-building potential."
      />

      {configured ? (
        <>
          <form className={styles.form} onSubmit={handleSubmit} aria-labelledby={titleId} noValidate>
            <div className={styles.fields}>
              <Input
                label="Planeswalker Handle"
                type="text"
                name="handle"
                autoComplete="nickname"
                placeholder="Liliana_Vess_99"
                value={handle}
                error={fieldErrors.handle}
                disabled={locked}
                required
                onChange={(event) => setHandle(event.target.value)}
              />
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
              <Input
                label="Spell-Password"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                hint="At least 8 characters."
                value={password}
                error={fieldErrors.password}
                disabled={locked}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
              <Input
                label="Confirm Spell-Password"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={confirmPassword}
                error={fieldErrors.confirmPassword}
                disabled={locked}
                required
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
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
              Create Account
            </Button>
          </form>

          <AuthDivider label="Or Forge With" />

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
        prompt="Already have an account?"
        href={authHref('/login', nextParam)}
        label="Sign in"
      />
    </AuthScaffold>
  );
}
