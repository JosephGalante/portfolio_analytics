import {
  Products,
  createStytchClient,
  type StytchLoginConfig,
} from "@stytch/nextjs";

const DEFAULT_REDIRECT_URL = "http://localhost:3000";
const rawPublicToken =
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN?.trim() ?? "";

export const isStytchConfigured = rawPublicToken.length > 0;
export const stytchClient = isStytchConfigured
  ? createStytchClient(rawPublicToken)
  : null;

function getRedirectURL(): string {
  const configuredRedirectUrl =
    process.env.NEXT_PUBLIC_STYTCH_LOGIN_REDIRECT_URL?.trim();

  if (configuredRedirectUrl) {
    return configuredRedirectUrl;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return DEFAULT_REDIRECT_URL;
}

export function createStytchLoginConfig(): StytchLoginConfig {
  const redirectURL = getRedirectURL();

  return {
    products: [Products.emailMagicLinks],
    emailMagicLinksOptions: {
      loginRedirectURL: redirectURL,
      loginExpirationMinutes: 30,
      signupRedirectURL: redirectURL,
      signupExpirationMinutes: 30,
    },
  };
}
