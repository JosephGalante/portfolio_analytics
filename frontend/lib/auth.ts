export type AuthSession = {
  email: string;
  password: string;
};

const AUTH_STORAGE_KEY = "portfolio_analytics.basic_auth";

export function encodeBasicAuth(authSession: AuthSession): string {
  const value = `${authSession.email}:${authSession.password}`;
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return `Basic ${window.btoa(value)}`;
  }

  return `Basic ${Buffer.from(value, "utf-8").toString("base64")}`;
}

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (rawValue === null) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthSession;
  } catch {
    return null;
  }
}

export function storeAuthSession(authSession: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
}

export function clearStoredAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
