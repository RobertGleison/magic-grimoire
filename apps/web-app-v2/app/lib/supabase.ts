import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[supabase] Missing ${name}. Add it to apps/web-app-v2/.env.local ` +
        '(NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are both required) ' +
        'and restart the dev server — Next.js inlines NEXT_PUBLIC_* at build time.',
    );
  }
  return value;
}

/**
 * Browser Supabase client, created on first use.
 *
 * Lazy on purpose: this module is imported by code that also runs during
 * server-side prerendering, and `createClient` must not run there.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    );
  }
  return client;
}

/** Access token of the current session, or `null` when nobody is signed in. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}
