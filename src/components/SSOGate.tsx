import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

function useSsoDebug(): boolean {
  if (typeof window === 'undefined') return false;
  return /[?&]sso_debug=1/.test(window.location.search);
}

function SsoDebugBar({ hasClientId, hasDomain }: { hasClientId: boolean; hasDomain: boolean }): React.ReactNode {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-400 text-amber-950 text-sm font-medium px-4 py-2 text-center shadow">
      SSO debug: client_id={hasClientId ? 'set' : 'NOT SET'}, allowed_domain={hasDomain ? 'set' : 'NOT SET'}
      {!hasClientId || !hasDomain ? ' — Set SSO_GOOGLE_CLIENT_ID and SSO_ALLOWED_DOMAIN in Vercel (not VITE_*).' : ''}
    </div>
  );
}

export function SSOGate({ children }: { children: React.ReactNode }) {
  const { user, isReady, signOut, error, ssoConfig, configLoaded } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const showDebug = useSsoDebug();
  const hasClientId = Boolean(ssoConfig?.googleClientId);
  const hasDomain = Boolean(ssoConfig?.allowedDomain);

  useEffect(() => {
    if (!hasClientId || !hasDomain || user || !isReady || !buttonRef.current) return;
    const g = window.google;
    if (g?.accounts?.id?.renderButton) {
      g.accounts.id.renderButton(buttonRef.current, { theme: 'filled_black', size: 'large' });
    }
  }, [isReady, user, hasClientId, hasDomain]);

  if (!configLoaded) {
    return (
      <>
        {showDebug && <SsoDebugBar hasClientId={false} hasDomain={false} />}
        <div className="flex items-center justify-center min-h-screen bg-grey-10 text-grey-500 font-sans">
          Loading…
        </div>
      </>
    );
  }

  if (!hasClientId || !hasDomain) {
    return (
      <>
        {showDebug && <SsoDebugBar hasClientId={hasClientId} hasDomain={hasDomain} />}
        {children}
      </>
    );
  }

  if (!isReady) {
    return (
      <>
        {showDebug && <SsoDebugBar hasClientId={hasClientId} hasDomain={hasDomain} />}
        <div className="flex items-center justify-center min-h-screen bg-grey-10 text-grey-500 font-sans">
          Loading…
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        {showDebug && <SsoDebugBar hasClientId={hasClientId} hasDomain={hasDomain} />}
        <div className="flex flex-col items-center justify-center min-h-screen bg-grey-10 p-4 font-sans">
        <div className="max-w-lg w-full bg-white rounded-4xl shadow-solid p-10 text-center animate-fade-in-from-bottom">
          <h2 className="text-3xl font-black leading-tighter text-grey-800 mb-4">
            Sign in <span className="text-green-200">required</span>
          </h2>
          <p className="text-grey-600 font-extralight tracking-compact leading-6 mb-6">
            This app is restricted to <strong>@{ssoConfig.allowedDomain}</strong>. Sign in with your work Google account.
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
      </>
    );
  }

  return (
    <>
      {showDebug && <SsoDebugBar hasClientId={hasClientId} hasDomain={hasDomain} />}
      {children}
    </>
  );
}

export function SSOHeaderSignOut() {
  const { user, signOut, ssoConfig } = useAuth();
  if (!ssoConfig?.allowedDomain || !user) return null;
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
