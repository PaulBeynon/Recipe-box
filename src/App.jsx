import React, { useEffect, useState } from 'react';
import { ChefHat, Loader2 } from 'lucide-react';
import { auth, watchAuthState, signInWithGoogle, signOutUser, installFirestoreStorageShim } from './firebase-init';
import RecipeBox from './RecipeBox';

const COLORS = {
  paper: '#FAF3E4',
  ink: '#2B2620',
  inkFaint: '#6B6255',
  rust: '#B8451F',
  cream: '#FFFDF8',
  cardBorder: '#D8CBB0',
};

function SignInScreen({ onSignIn, signingIn, error }) {
  return (
    <div style={{
      minHeight: '100vh', background: COLORS.paper, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
    }}>
      <ChefHat size={40} color={COLORS.rust} style={{ marginBottom: '14px' }} />
      <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '26px', color: COLORS.ink, margin: '0 0 8px' }}>
        The Recipe Box
      </h1>
      <p style={{ color: COLORS.inkFaint, fontSize: '14px', marginBottom: '26px', maxWidth: '320px' }}>
        Sign in to see your own recipes, shopping list, and meal plan. Nobody else can see your library.
      </p>
      <button
        onClick={onSignIn}
        disabled={signingIn}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', background: COLORS.rust, color: COLORS.cream,
          border: 'none', borderRadius: '4px', padding: '13px 26px', fontSize: '15px', fontWeight: 600,
          cursor: signingIn ? 'default' : 'pointer', opacity: signingIn ? 0.7 : 1,
        }}
      >
        {signingIn ? <Loader2 size={18} className="animate-spin" /> : null}
        {signingIn ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && (
        <p style={{ color: COLORS.rust, fontSize: '13px', marginTop: '16px', maxWidth: '300px' }}>{error}</p>
      )}
    </div>
  );
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');

  useEffect(() => {
    const unsubscribe = watchAuthState((u) => {
      setUser(u);
      setAuthChecked(true);
      if (u) installFirestoreStorageShim();
    });
    return unsubscribe;
  }, []);

  async function handleSignIn() {
    setSigningIn(true);
    setSignInError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setSignInError(err?.message || 'Could not sign in. Please try again.');
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await signOutUser();
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.paper, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={26} className="animate-spin" color={COLORS.inkFaint} />
      </div>
    );
  }

  if (!user) {
    return <SignInScreen onSignIn={handleSignIn} signingIn={signingIn} error={signInError} />;
  }

  return <RecipeBox onSignOut={handleSignOut} key={user.uid} />;
}
