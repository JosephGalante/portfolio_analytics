import {stytchClient} from './stytch';

const GUEST_SESSION_STORAGE_KEY = 'portfolio-analytics.guest-session';

export const isGuestDemoConfigured =
  process.env.NEXT_PUBLIC_GUEST_DEMO_MODE?.trim().toLowerCase() === 'true';

export function getStoredGuestSessionToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const token = window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY)?.trim();
    return token ? token : null;
  } catch {
    return null;
  }
}

export function storeGuestSessionToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, token);
}

export function clearStoredGuestSessionToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
}

export function getStoredAuthorizationHeader(): string | null {
  const guestSessionToken = getStoredGuestSessionToken();
  if (guestSessionToken) {
    return `Bearer ${guestSessionToken}`;
  }

  if (stytchClient === null) {
    return null;
  }

  try {
    const sessionJwt = stytchClient.session.getTokens()?.session_jwt?.trim();
    if (sessionJwt) {
      return `Bearer ${sessionJwt}`;
    }
  } catch {
    return null;
  }

  return null;
}
