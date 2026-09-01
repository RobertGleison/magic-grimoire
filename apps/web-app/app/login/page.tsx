import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '../components/Spinner/Spinner';
import { LoginForm } from './LoginForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Enter the Grimoire',
  description: 'Sign in to Magic Grimoire to reach your saved decks and build new ones.',
};

/**
 * Server shell for `/login`. The interactive form is a separate client
 * component because it reads `?next=` with `useSearchParams`, which Next
 * requires to sit inside a Suspense boundary.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.pending}>
          <Spinner size="lg" label="Loading sign-in" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
