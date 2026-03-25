import {stytchClient} from "./stytch";

export function getStoredAuthorizationHeader(): string | null {
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
