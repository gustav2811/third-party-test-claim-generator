import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const ALLOWED_DOMAIN = (import.meta.env.VITE_ALLOWED_DOMAIN as string | undefined)?.toLowerCase();

/** Google Identity Services (GSI) – shape we need from window.google */
interface GoogleGSI {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        hosted_domain: string;
        callback: (res: { credential: string }) => void;
        auto_select?: boolean;
      }) => void;
      renderButton: (el: HTMLElement, config: object) => void;
      prompt: (cb?: (err: unknown) => void) => void;
      disableAutoSelect?: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleGSI;
  }
}

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  hostedDomain: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  idToken: string | null;
  isReady: boolean;
  signIn: () => void;
  signOut: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = 'sso_claim_generator';

function parseJwtPayload(token: string): { email?: string; name?: string; picture?: string; hd?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

function loadStoredSession(): { user: AuthUser; idToken: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { user, idToken } = JSON.parse(raw) as { user: AuthUser; idToken: string };
    if (!user?.email || !idToken) return null;
    return { user, idToken };
  } catch {
    return null;
  }
}

function saveSession(user: AuthUser, idToken: string): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, idToken }));
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
    setIdToken(null);
    setError(null);
    window.google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  const signIn = useCallback(() => {
    setError(null);
    window.google?.accounts?.id?.prompt((err: unknown) => {
      if (err) setError(err instanceof Error ? err.message : 'Sign-in was cancelled or failed.');
    });
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !ALLOWED_DOMAIN) {
      setIsReady(true);
      return;
    }

    const stored = loadStoredSession();
    if (stored) {
      setUser(stored.user);
      setIdToken(stored.idToken);
      setIsReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const g = window.google;

      if (!g?.accounts?.id) {
        setError('Google Sign-In failed to load.');
        setIsReady(true);
        return;
      }

      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        hosted_domain: ALLOWED_DOMAIN,
        callback: (response: { credential: string }) => {
          const payload = parseJwtPayload(response.credential);
          if (!payload?.email) {
            setError('Sign-in failed: no email in response.');
            return;
          }
          const authUser: AuthUser = {
            email: payload.email,
            name: payload.name ?? payload.email,
            picture: payload.picture,
            hostedDomain: payload.hd ?? '',
          };
          setUser(authUser);
          setIdToken(response.credential);
          saveSession(authUser, response.credential);
          setError(null);
        },
        auto_select: false,
      });

      setIsReady(true);
    };
    script.onerror = () => {
      setError('Failed to load Google Sign-In.');
      setIsReady(true);
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  const value: AuthContextValue = {
    user,
    idToken,
    isReady,
    signIn,
    signOut,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
