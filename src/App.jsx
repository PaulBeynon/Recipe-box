import React, { useEffect, useState } from 'react';
import { ChefHat, Loader2 } from 'lucide-react';
import {
  auth, watchAuthState, signInWithGoogle, signInWithGooglePopup, signOutUser,
  installFirestoreStorageShim, checkRedirectResult, REDIRECT_PENDING_KEY,
} from './firebase-init';
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
    // Catches the result (or error) when the browser returns from Google's sign-in redirect —
    // relevant now only when handleSignIn below had to fall back to redirect because popup
    // itself didn't work. Harmless no-op if there was no pending redirect.
    const wasRedirectPending = sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1';
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    checkRedirectResult()
      .then((result) => {
        // A known Firebase issue: some browsers block the cross-origin storage access the
        // redirect flow's default authDomain relies on, and this just quietly resolves to
        // null with no error at all. If we already tried popup and it also had to fall back
        // to this, there's nothing else left to try automatically.
        if (!result && wasRedirectPending) {
          setSignInError("Sign-in didn't complete in this browser. Please try again, or let me know if this keeps happening.");
        }
      })
      .catch((err) => {
        setSignInError(err?.message || 'Sign-in failed. Please try again.');
      });
    const unsubscribe = watchAuthState((u) => {
      setUser(u);
      setAuthChecked(true);
      if (u) installFirestoreStorageShim();
    });
    return unsubscribe;
  }, []);

  // Errors where the popup mechanism itself didn't work (blocked, unsupported, or closed
  // before completing) — worth silently retrying via redirect. Anything else (wrong config,
  // network failure, etc.) is a real error redirect won't fix either, so it's shown as-is.
  const POPUP_FALLBACK_CODES = new Set([
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
    'auth/popup-closed-by-user',
    'auth/cancelled-popup-request',
  ]);

  function handleSignIn() {
    setSigningIn(true);
    setSignInError('');
    signInWithGooglePopup()
      .then(() => setSigningIn(false))
      .catch((err) => {
        if (POPUP_FALLBACK_CODES.has(err?.code)) {
          // signInWithRedirect navigates the whole page away to Google and back — there's no
          // promise to await here, the result is picked up by checkRedirectResult() above
          // once the page reloads.
          signInWithGoogle().catch((redirectErr) => {
            setSignInError(redirectErr?.message || 'Could not sign in. Please try again.');
            setSigningIn(false);
          });
          return;
        }
        setSignInError(err?.message || 'Could not sign in. Please try again.');
        setSigningIn(false);
      });
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
