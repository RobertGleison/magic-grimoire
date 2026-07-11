'use client';

import { useEffect, useState } from 'react';
import './Toast.css';

interface ToastProps {
  message: string;
  storageKey: string;
  duration?: number;
}

export function Toast({ message, storageKey, duration = 8000 }: ToastProps) {
  const [visible, setVisible] = useState(false);
  console.log('TOAST RENDER visible=', visible);

  useEffect(() => {
    console.log('TOAST EFFECT RUN', storageKey, localStorage.getItem(storageKey));
    if (localStorage.getItem(storageKey)) return;
    setVisible(true);
    localStorage.setItem(storageKey, '1');

    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [storageKey, duration]);

  if (!visible) return null;

  return (
    <div className="toast">
      <p className="toast-message">{message}</p>
      <button className="toast-close" onClick={() => setVisible(false)} aria-label="Dismiss">×</button>
    </div>
  );
}
