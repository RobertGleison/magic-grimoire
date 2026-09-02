import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '../components/Spinner/Spinner';
import { SignupForm } from './SignupForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Create Your Account',
  description: 'Create a Magic Grimoire account to build and keep unlimited AI-generated decks.',
};

/**
 * Server shell for `/signup`. The interactive form is a separate client
 * component because it reads `?next=` with `useSearchParams`, which Next
 * requires to sit inside a Suspense boundary.
 */
export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.pending}>
          <Spinner size="lg" label="Loading sign-up" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
