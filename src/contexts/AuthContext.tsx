import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface SsoConfig {
  googleClientId: string;
  allowedDomain: string;
}

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
  ssoConfig: SsoConfig | null;
  configLoaded: boolean;
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
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        const data = (await res.json()) as { googleClientId?: string; allowedDomain?: string };
        const clientId = (data.googleClientId ?? '').trim();
        const domain = (data.allowedDomain ?? '').trim().toLowerCase();
        if (clientId && domain) {
          setSsoConfig({ googleClientId: clientId, allowedDomain: domain });
        }
      } catch {
        const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
        const domain = (import.meta.env.VITE_ALLOWED_DOMAIN as string | undefined)?.trim().toLowerCase();
        if (clientId && domain) {
          setSsoConfig({ googleClientId: clientId, allowedDomain: domain });
        }
      }
      setConfigLoaded(true);
    }
    loadConfig();
  }, []);


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
    if (!configLoaded) {
      setIsReady(false);
      return;
    }

    if (!ssoConfig) {
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

    setIsReady(false);

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
        client_id: ssoConfig.googleClientId,
        hosted_domain: ssoConfig.allowedDomain,
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
  }, [ssoConfig, configLoaded]);


  const value: AuthContextValue = {
    user,
    idToken,
    isReady,
    signIn,
    signOut,
    error,
    ssoConfig,
    configLoaded,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
