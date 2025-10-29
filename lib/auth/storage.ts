'use client';

const USER_STORAGE_KEY = 'notes.e2shub.authUser';

const isBrowser = () => typeof window !== 'undefined';

export const getStoredUser = <T = unknown>(): T | null => {
  if (!isBrowser()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('Failed to read stored user', error);
    return null;
  }
};

export const setStoredUser = (user: unknown) => {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user ?? null));
  } catch (error) {
    console.error('Failed to persist user', error);
  }
};

export const clearStoredUser = () => {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear stored user', error);
  }
};
