'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  email: string;
  name: string;
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

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mg_user');
      if (stored) setUserState(JSON.parse(stored));
    } catch {}
  }, []);

  const setUser = (u: User | null) => {
    setUserState(u);
    try {
      if (u) localStorage.setItem('mg_user', JSON.stringify(u));
      else localStorage.removeItem('mg_user');
    } catch {}
  };

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
