'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  createUser,
  findUserByEmail,
  getUser,
  listSubscriptions,
  type UserCreateInput,
  type UserDto,
} from '@/lib/queries';
import type { SubscriptionDto } from '@/lib/queries';
import {
  clearStoredUser,
  getStoredUser,
  setStoredUser,
} from '@/lib/auth/storage';

interface LoginPayload {
  email: string;
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
  logout: () => void;
  refreshUser: (id: string) => Promise<UserDto | null>;
  refreshSubscription: () => Promise<SubscriptionDto | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const loadSubscription = useCallback(async (userId: string) => {
    try {
      const page = await listSubscriptions({ size: 100 });
      const nextSubscription =
        page.content?.find((item) => item.userId === userId) ?? null;
      setSubscription(nextSubscription);
      return nextSubscription;
    } catch (error) {
      console.error('Failed to fetch subscription', error);
      setSubscription(null);
      return null;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearStoredUser();
    setUser(null);
    setSubscription(null);
  }, []);

  const login = useCallback(
    async ({ email }: LoginPayload) => {
      setLoading(true);
      try {
        const existing = await findUserByEmail(email);
        if (!existing) {
          throw new Error('User not found');
        }
        setUser(existing);
        setStoredUser(existing);
        await loadSubscription(existing.id);
        return existing;
      } finally {
        setLoading(false);
      }
    },
    [loadSubscription]
  );

  const signup = useCallback(
    async ({ email, fullName }: SignupPayload) => {
      setLoading(true);
      try {
        const payload: UserCreateInput = {
          email,
          fullName,
          avatarUrl: null,
          billingAddress: null,
          paymentMethod: null,
          updatedAt: null,
        };
        const created = await createUser(payload);
        setUser(created);
        setStoredUser(created);
        await loadSubscription(created.id);
        return created;
      } finally {
        setLoading(false);
      }
    },
    [loadSubscription]
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(
    async (id: string) => {
      if (!id) {
        return null;
      }
      try {
        const fresh = await getUser(id);
        setUser(fresh);
        setStoredUser(fresh);
        await loadSubscription(fresh.id);
        return fresh;
      } catch (error) {
        console.error('Failed to refresh user', error);
        clearSession();
        return null;
      }
    },
    [loadSubscription, clearSession]
  );

  const refreshSubscription = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setSubscription(null);
      return null;
    }
    return loadSubscription(userId);
  }, [loadSubscription, user?.id]);

  useEffect(() => {
    const storedUser = getStoredUser<UserDto>();

    if (!storedUser?.id) {
      setInitializing(false);
      return;
    }

    setUser(storedUser);

    let active = true;

    const bootstrap = async () => {
      try {
        await loadSubscription(storedUser.id);
        await refreshUser(storedUser.id);
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, [loadSubscription, refreshUser]);

  const value = useMemo(
    () => ({
      user,
      subscription,
      loading,
      initializing,
      login,
      signup,
      logout,
      refreshUser,
      refreshSubscription,
    }),
    [
      user,
      subscription,
      loading,
      initializing,
      login,
      signup,
      logout,
      refreshUser,
      refreshSubscription,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
