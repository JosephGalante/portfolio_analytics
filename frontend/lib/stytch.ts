import {createStytchClient} from "@stytch/nextjs";

const DEFAULT_PASSWORD_RESET_REDIRECT_URL =
  "http://localhost:3000/authenticate";
const rawPublicToken =
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN?.trim() ?? "";

export const isStytchConfigured = rawPublicToken.length > 0;
export const stytchClient = isStytchConfigured
  ? createStytchClient(rawPublicToken)
  : null;

export function getStytchPasswordResetRedirectUrl(): string {
  const configuredRedirectUrl =
    process.env.NEXT_PUBLIC_STYTCH_PASSWORD_RESET_REDIRECT_URL?.trim() ??
    process.env.NEXT_PUBLIC_STYTCH_LOGIN_REDIRECT_URL?.trim();

  if (configuredRedirectUrl) {
    return configuredRedirectUrl;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/authenticate`;
  }

  return DEFAULT_PASSWORD_RESET_REDIRECT_URL;
}
