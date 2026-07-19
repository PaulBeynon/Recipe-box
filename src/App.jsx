import React, { useEffect, useState } from 'react';
import { ChefHat, Loader2 } from 'lucide-react';
import {
  auth, watchAuthState, signInWithGoogle, signInWithGooglePopup, signOutUser,
  installFirestoreStorageShim, checkRedirectResult, REDIRECT_PENDING_KEY,
  createAccountWithEmail, signInWithEmail, resetPasswordForEmail,
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

const EMAIL_ERROR_MESSAGES = {
  'auth/invalid-email': 'That doesn\'t look like a valid email address.',
  'auth/user-not-found': 'No account found with that email — try "Create account" instead.',
  'auth/wrong-password': 'That password doesn\'t match this email.',
  'auth/invalid-credential': 'Email or password doesn\'t match. Check both and try again.',
  'auth/email-already-in-use': 'An account already exists with that email — try signing in instead.',
  'auth/weak-password': 'Please choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts — please wait a bit and try again.',
  'auth/operation-not-allowed': 'Email sign-in isn\'t turned on for this app yet.',
};

function friendlyAuthError(err) {
  return EMAIL_ERROR_MESSAGES[err?.code] || err?.message || 'Something went wrong. Please try again.';
}

function inputStyle() {
  return {
    width: '100%', padding: '11px 12px', fontSize: '14px', border: '1px solid #D8CBB0',
    borderRadius: '4px', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
  };
}

function SignInScreen({
  onSignIn, signingIn, error,
  emailMode, setEmailMode, email, setEmail, password, setPassword,
  onEmailSignIn, onEmailSignUp, onForgotPassword, emailBusy, emailNotice,
}) {
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
        disabled={signingIn || emailBusy}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', background: COLORS.rust, color: COLORS.cream,
          border: 'none', borderRadius: '4px', padding: '13px 26px', fontSize: '15px', fontWeight: 600,
          cursor: signingIn ? 'default' : 'pointer', opacity: signingIn ? 0.7 : 1, width: '100%', maxWidth: '300px',
          justifyContent: 'center',
        }}
      >
        {signingIn ? <Loader2 size={18} className="animate-spin" /> : null}
        {signingIn ? 'Signing in…' : 'Sign in with Google'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '300px', margin: '20px 0', gap: '10px' }}>
        <div style={{ flex: 1, height: '1px', background: COLORS.cardBorder }} />
        <span style={{ color: COLORS.inkFaint, fontSize: '12px' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: COLORS.cardBorder }} />
      </div>

      <div style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle()}
        />
        <input
          type="password"
          autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle()}
        />
        {emailMode === 'signin' ? (
          <button
            onClick={onEmailSignIn}
            disabled={emailBusy || signingIn}
            style={{
              background: 'none', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, borderRadius: '4px',
              padding: '11px', fontSize: '14px', fontWeight: 600, cursor: emailBusy ? 'default' : 'pointer',
            }}
          >
            {emailBusy ? 'Signing in…' : 'Sign in with email'}
          </button>
        ) : (
          <button
            onClick={onEmailSignUp}
            disabled={emailBusy || signingIn}
            style={{
              background: 'none', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, borderRadius: '4px',
              padding: '11px', fontSize: '14px', fontWeight: 600, cursor: emailBusy ? 'default' : 'pointer',
            }}
          >
            {emailBusy ? 'Creating account…' : 'Create account'}
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: COLORS.inkFaint, marginTop: '2px' }}>
          <button
            onClick={() => setEmailMode(emailMode === 'signin' ? 'signup' : 'signin')}
            style={{ background: 'none', border: 'none', color: COLORS.inkFaint, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
          >
            {emailMode === 'signin' ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
          {emailMode === 'signin' && (
            <button
              onClick={onForgotPassword}
              style={{ background: 'none', border: 'none', color: COLORS.inkFaint, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>

      {emailNotice && (
        <p style={{ color: COLORS.inkFaint, fontSize: '13px', marginTop: '16px', maxWidth: '300px' }}>{emailNotice}</p>
      )}
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
  const [emailMode, setEmailMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState('');

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

  // Only fall back to redirect for errors that mean the popup mechanism genuinely isn't
  // available here (blocked outright, or unsupported in this environment) — not "popup-closed"
  // or "cancelled-popup-request", which usually just mean a transient hiccup on this attempt.
  // Falling back to redirect for those would be a downgrade if popup normally works fine on
  // this browser but redirect doesn't (exactly the situation on some Chrome setups) — better
  // to just let the person try the same button again.
  const POPUP_FALLBACK_CODES = new Set([
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
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

  async function handleEmailSignIn() {
    setEmailBusy(true);
    setSignInError('');
    setEmailNotice('');
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      setSignInError(friendlyAuthError(err));
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleEmailSignUp() {
    setEmailBusy(true);
    setSignInError('');
    setEmailNotice('');
    try {
      await createAccountWithEmail(email.trim(), password);
    } catch (err) {
      setSignInError(friendlyAuthError(err));
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setSignInError('Enter your email above first, then tap "Forgot password?" again.');
      return;
    }
    setEmailBusy(true);
    setSignInError('');
    setEmailNotice('');
    try {
      await resetPasswordForEmail(email.trim());
      setEmailNotice('Password reset email sent — check your inbox.');
    } catch (err) {
      setSignInError(friendlyAuthError(err));
    } finally {
      setEmailBusy(false);
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
    return (
      <SignInScreen
        onSignIn={handleSignIn}
        signingIn={signingIn}
        error={signInError}
        emailMode={emailMode}
        setEmailMode={setEmailMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        onEmailSignIn={handleEmailSignIn}
        onEmailSignUp={handleEmailSignUp}
        onForgotPassword={handleForgotPassword}
        emailBusy={emailBusy}
        emailNotice={emailNotice}
      />
    );
  }

  return <RecipeBox onSignOut={handleSignOut} key={user.uid} />;
}
