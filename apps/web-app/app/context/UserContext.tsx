'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export interface User {
  email: string;
  name: string;
  accessToken: string;
}

interface UserContextType {
  user: User | null;
  setUser: (u: User | null) => void;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  authOpen: false,
  openAuth: () => {},
  closeAuth: () => {},
});

function userFromSession(session: Session): User {
  return {
    email: session.user.email ?? '',
    name:
      (session.user.user_metadata?.full_name as string | undefined) ??
      session.user.email?.split('@')[0] ??
      '',
    accessToken: session.access_token,
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserState(session ? userFromSession(session) : null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserState(session ? userFromSession(session) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setUser = (u: User | null) => setUserState(u);

  return (
    <UserContext.Provider value={{
      user, setUser,
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
