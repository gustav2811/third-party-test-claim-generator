import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_DOMAIN as string | undefined;

export function SSOGate({ children }: { children: React.ReactNode }) {
  const { user, isReady, signOut, error } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !ALLOWED_DOMAIN || user || !isReady || !buttonRef.current) return;
    const g = window.google;
    if (g?.accounts?.id?.renderButton) {
      g.accounts.id.renderButton(buttonRef.current, { theme: 'filled_black', size: 'large' });
    }
  }, [isReady, user]);

  if (!GOOGLE_CLIENT_ID || !ALLOWED_DOMAIN) {
    return <>{children}</>;
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-grey-10 text-grey-500 font-sans">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-grey-10 p-4 font-sans">
        <div className="max-w-lg w-full bg-white rounded-4xl shadow-solid p-10 text-center animate-fade-in-from-bottom">
          <h2 className="text-3xl font-black leading-tighter text-grey-800 mb-4">
            Sign in <span className="text-green-200">required</span>
          </h2>
          <p className="text-grey-600 font-extralight tracking-compact leading-6 mb-6">
            This app is restricted to <strong>@{ALLOWED_DOMAIN}</strong>. Sign in with your work Google account.
          </p>
          {error && (
            <p className="text-red-500 mb-6 font-medium" data-testid="sso-error">
              {error}
            </p>
          )}
          <div ref={buttonRef} className="flex justify-center mb-6" />
          <p className="text-sm text-grey-500">
            Only accounts from your organisation&apos;s Google Workspace can access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function SSOHeaderSignOut() {
  const { user, signOut } = useAuth();
  const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_DOMAIN as string | undefined;
  if (!ALLOWED_DOMAIN || !user) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-grey-600 truncate max-w-[160px]" title={user.email}>
        {user.email}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="text-sm font-bold text-grey-600 hover:text-grey-800 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
