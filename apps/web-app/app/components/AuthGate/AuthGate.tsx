'use client';

import { useState } from 'react';
import { useUser } from '../../context/UserContext';
import AuthModal from '../AuthModal/AuthModal';

export default function AuthGate() {
  const { authOpen, closeAuth, setUser } = useUser();
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  if (!authOpen) return null;

  return (
    <AuthModal
      mode={mode}
      onClose={closeAuth}
      onSuccess={(u) => { setUser(u); closeAuth(); }}
      onSwitchMode={setMode}
    />
  );
}
