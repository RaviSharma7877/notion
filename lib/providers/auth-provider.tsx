'use client';
import {
  loginRequest,
  signupRequest,
  type SubscriptionDto,
  type UserDto,
} from '@/lib/queries';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface SignupPayload {
  email: string;
  fullName: string;
}

interface AuthContextValue {
  user: UserDto | null;
  subscription: SubscriptionDto | null;
  loading: boolean;
  initializing: boolean;
  login: (payload: LoginPayload) => Promise<UserDto>;
  signup: (payload: SignupPayload) => Promise<UserDto>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserDto | null>;
  refreshSubscription: () => Promise<SubscriptionDto | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const loadSubscription = useCallback(async () => {
    const fallbackSubscription: SubscriptionDto = {
      id: 'subscription-demo',
      userId: 'demo-user',
      status: 'ACTIVE',
      metadata: null,
      priceId: null,
      quantity: 1,
      cancelAtPeriodEnd: false,
      created: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: null,
      cancelAt: null,
      canceledAt: null,
      trialStart: null,
      trialEnd: null,
    };

    setSubscription(fallbackSubscription);
    return fallbackSubscription;
  }, []);

  const clearSession = useCallback(() => {
    clearStoredUser();
    setUser(null);
    setSubscription(null);
  }, []);

  const login = useCallback(
    async ({ email: loginEmail, password, rememberMe }: LoginPayload) => {
      setLoading(true);
      try {
        const result = await loginRequest({ email: loginEmail, password, rememberMe });
        const responseUser = result.user ?? {};

        const fallbackId = resolveStringId(responseUser.id) ?? resolveStringId(result.userId) ?? `user-${Date.now()}`;
        const normalizedUser: UserDto = {
          ...responseUser,
          id: fallbackId,
          userId: resolveStringId(responseUser.userId) ?? resolveStringId(result.userId) ?? fallbackId,
          userSecretId: resolveStringId(responseUser.userSecretId) ?? fallbackId,
          email: resolveEmail(responseUser.email, loginEmail) ?? loginEmail,
        };

        let session: StoredAuthSession = {
          ...normalizedUser,
          token: result.accessToken,
          refreshToken: result.refreshToken ?? null,
        };

        setStoredUser(session);

        setUser(normalizedUser);
        await loadSubscription();
        return normalizedUser;
      } catch (error) {
        clearSession();
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [clearSession, loadSubscription]
  );

  const signup = useCallback(
    async ({ email: signupEmail, fullName }: SignupPayload) => {
      setLoading(true);
      try {
        const result = await signupRequest({ email: signupEmail, fullName });
        const responseUser = result.user ?? {};

        const fallbackId = resolveStringId(responseUser.id) ?? resolveStringId(result.userId) ?? `user-${Date.now()}`;
        const normalizedUser: UserDto = {
          ...responseUser,
          id: fallbackId,
          userId: resolveStringId(responseUser.userId) ?? resolveStringId(result.userId) ?? fallbackId,
          userSecretId: resolveStringId(responseUser.userSecretId) ?? fallbackId,
          email: resolveEmail(responseUser.email, signupEmail) ?? signupEmail,
        };

        let session: StoredAuthSession = {
          ...normalizedUser,
          token: result.accessToken,
          refreshToken: result.refreshToken ?? null,
        };

        setStoredUser(session);

        setUser(normalizedUser);
        await loadSubscription();
        return normalizedUser;
      } catch (error) {
        clearSession();
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [clearSession, loadSubscription]
  );

  const logout = useCallback(async () => {
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const stored = getStoredUser<StoredAuthSession>();
    if (!stored?.token) {
      clearSession();
      return null;
    }
    setUser(stored);
    await loadSubscription();
    return stored;
  }, [clearSession, loadSubscription]);

  const refreshSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      return null;
    }
    return loadSubscription();
  }, [loadSubscription, user]);

  useEffect(() => {
    const stored = getStoredUser<StoredAuthSession>();
    if (stored?.token) {
      setUser(stored);
      loadSubscription().finally(() => {
        setInitializing(false);
      });
      return;
    }
    setInitializing(false);
  }, [loadSubscription]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    subscription,
    loading,
    initializing,
    login,
    logout,
    signup,
    refreshUser,
    refreshSubscription,
  }), [user, subscription, loading, initializing, login, logout, signup, refreshUser, refreshSubscription]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface StoredAuthSession extends UserDto {
  token: string | null;
  refreshToken: string | null;
}
const AUTH_STORAGE_KEY = 'notes.e2shub.auth-session';

const getStoredUser = <T,>(): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const setStoredUser = (value: StoredAuthSession | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (!value) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

const clearStoredUser = () => {
  setStoredUser(null);
};

const resolveStringId = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return undefined;
};

const resolveEmail = (value: unknown, fallback: string | null = null): string | null => {
  if (typeof value === 'string' && value.length > 0) return value;
  return fallback;
};
