'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface User {
  email: string;
  name: string;
}

interface UserContextType {
  user: User | null;
  token: string | null;
  ready: boolean;
  signOut: () => void;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  token: null,
  ready: false,
  signOut: () => {},
  authOpen: false,
  openAuth: () => {},
  closeAuth: () => {},
});

function toUser(session: Session | null): User | null {
  if (!session) return null;
  const { email, user_metadata } = session.user;
  return {
    email: email ?? '',
    name: user_metadata?.full_name ?? user_metadata?.name ?? email?.split('@')[0] ?? 'Planeswalker',
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{
      user: toUser(session),
      token: session?.access_token ?? null,
      ready,
      signOut: () => { supabase.auth.signOut(); },
      authOpen,
      openAuth: () => setAuthOpen(true),
      closeAuth: () => setAuthOpen(false),
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
