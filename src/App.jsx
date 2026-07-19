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

function SignInScreen({ onSignIn, onSignInPopup, signingIn, error, showPopupFallback }) {
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
      {showPopupFallback && (
        <button
          onClick={onSignInPopup}
          disabled={signingIn}
          style={{
            background: 'none', border: 'none', color: COLORS.inkFaint, fontSize: '13px',
            textDecoration: 'underline', cursor: signingIn ? 'default' : 'pointer', marginTop: '14px', padding: 0,
          }}
        >
          Try a different sign-in method
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [showPopupFallback, setShowPopupFallback] = useState(false);

  useEffect(() => {
    // Catches the result (or error) when the browser returns from Google's sign-in redirect.
    // Runs once on load; harmless no-op if there was no pending redirect.
    const wasRedirectPending = sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1';
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    checkRedirectResult()
      .then((result) => {
        // A known Firebase issue: some browsers block the cross-origin storage access the
        // redirect flow's default authDomain relies on, and this just quietly resolves to
        // null with no error — no exception to catch, nothing in the console. The only way
        // to tell it apart from "nobody's tried to sign in yet" is the marker set right
        // before we navigated away.
        if (!result && wasRedirectPending) {
          setSignInError("Sign-in didn't complete in this browser. This can happen due to browser privacy settings — try the alternative method below.");
          setShowPopupFallback(true);
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

  function handleSignIn() {
    setSigningIn(true);
    setSignInError('');
    // signInWithRedirect navigates the whole page away to Google and back —
    // there's no promise to await here, the result is picked up by
    // checkRedirectResult() above once the page reloads.
    signInWithGoogle().catch((err) => {
      setSignInError(err?.message || 'Could not sign in. Please try again.');
      setSigningIn(false);
    });
  }

  function handleSignInPopup() {
    setSigningIn(true);
    setSignInError('');
    signInWithGooglePopup()
      .then(() => setShowPopupFallback(false))
      .catch((err) => {
        setSignInError(err?.message || 'Could not sign in. Please try again.');
      })
      .finally(() => setSigningIn(false));
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
    return (
      <SignInScreen
        onSignIn={handleSignIn}
        onSignInPopup={handleSignInPopup}
        signingIn={signingIn}
        error={signInError}
        showPopupFallback={showPopupFallback}
      />
    );
  }

  return <RecipeBox onSignOut={handleSignOut} key={user.uid} />;
}
