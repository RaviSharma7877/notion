type Nullable<T> = T | null | undefined;
type UserLike = {
  id?: string | number | null;
  userId?: string | number | null;
  userSecretId?: string | null;
  email?: string | null;
  emailAddress?: string | null;
  userSecurity?: {
    userSecretId?: string;
    email?: string;
  };
  profile?: {
    userSecretId?: string;
    email?: string;
  };
  userEmail?: {
    userSecretId?: string;
    email?: string;
  };
  security?: {
    userSecretId?: string;
    email?: string;
  };
  [key: string]: unknown;
} | {
  user?: UserLike;
  userSecretId?: string;
  userSecurity?: {
    userSecretId?: string;
    email?: string;
  };
  [key: string]: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function extractUserSecretId(user: Nullable<UserLike>): string | undefined {
  if (!user) return undefined;

  const base = (user as Record<string, unknown>) ?? {};

  const candidates: Array<unknown> = [
    (base as any)?.userSecretId,
    (base as any)?.user?.userSecretId,
    (base as any)?.userSecurity?.userSecretId,
    (base as any)?.user?.userSecurity?.userSecretId,
    (base as any)?.security?.userSecretId,
    (base as any)?.profile?.userSecretId,
    (base as any)?.userEmail?.userSecretId,
    (base as any)?.user?.profile?.userSecretId,
    (base as any)?.id,
  ];

  const match = candidates.find((value) => {
    if (!isNonEmptyString(value)) return false;
    return value.includes('-') || /[a-zA-Z]/.test(value);
  }) as string | undefined;

  return match ? match : undefined;
}

export function extractUserNumericId(user: Nullable<UserLike>): string | number | undefined {
  if (!user) return undefined;

  const base = (user as Record<string, unknown>) ?? {};
  const candidates: Array<unknown> = [
    (base as any)?.userId,
    (base as any)?.user?.userId,
    (base as any)?.id,
  ];

  for (const value of candidates) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      // treat purely numeric strings as numeric identifiers
      if (/^\d+$/.test(value)) {
        return value;
      }
    }
  }

  return undefined;
}

export function resolveWorkspaceOwnerId(user: Nullable<UserLike>): string | undefined {
  const secret = extractUserSecretId(user);
  if (secret) return secret;

  const candidate = extractUserNumericId(user);
  if (candidate === undefined) return undefined;

  return typeof candidate === 'number' ? String(candidate) : candidate;
}

export function extractUserEmail(user: Nullable<UserLike>): string | undefined {
  if (!user) return undefined;
  const base = (user as Record<string, unknown>) ?? {};
  const candidates: Array<unknown> = [
    (base as any)?.email,
    (base as any)?.emailAddress,
    (base as any)?.user?.email,
    (base as any)?.user?.emailAddress,
    (base as any)?.profile?.email,
    (base as any)?.userEmail?.email,
    (base as any)?.security?.email,
    (base as any)?.userSecurity?.email,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.includes('@')) {
      return value;
    }
  }

  return undefined;
}

export function resolveUserServiceId(user: Nullable<UserLike>): string | number | undefined {
  const numeric = extractUserNumericId(user);
  if (numeric !== undefined) {
    return numeric;
  }

  const base = (user as any) ?? {};
  const candidate = base?.userId ?? base?.id;
  if (typeof candidate === 'number') {
    return candidate;
  }
  if (typeof candidate === 'string' && /^\d+$/.test(candidate)) {
    return candidate;
  }
  return undefined;
}
