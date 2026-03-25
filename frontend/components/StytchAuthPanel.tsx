"use client";

import {StytchLogin, useStytch, useStytchSession} from "@stytch/nextjs";
import {useMemo, useState} from "react";

import {createStytchLoginConfig} from "@/lib/stytch";

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function StytchAuthPanel() {
  const stytch = useStytch();
  const loginConfig = useMemo(createStytchLoginConfig, []);
  const {isInitialized, session} = useStytchSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setErrorMessage(null);
    setIsSigningOut(true);

    try {
      await stytch.session.revoke();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Failed to sign out of Stytch."));
    } finally {
      setIsSigningOut(false);
    }
  }

  if (!isInitialized) {
    return (
      <section className="panel auth-panel">
        <div className="panel-header">
          <h2>Email sign-in</h2>
          <span>Stytch</span>
        </div>
        <p className="lede">Loading your Stytch session.</p>
      </section>
    );
  }

  if (session !== null) {
    return (
      <section className="panel auth-panel">
        <div className="panel-header">
          <h2>Stytch connected</h2>
          <span>Email session active</span>
        </div>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        <p className="success-banner">
          Magic-link auth is now wired in the frontend.
        </p>
        <p className="lede">
          This step stops here on purpose. The backend still expects the legacy
          local auth path, so portfolio API access and websocket ownership have
          not been switched over yet.
        </p>
        <button disabled={isSigningOut} onClick={() => void handleSignOut()}>
          {isSigningOut ? "Signing out..." : "Sign out of Stytch"}
        </button>
      </section>
    );
  }

  return (
    <section className="panel auth-panel">
      <div className="panel-header">
        <h2>Sign in</h2>
        <span>Email magic links</span>
      </div>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <p className="lede">
        Enter your email and Stytch will send the sign-in link for this app.
      </p>

      <StytchLogin
        callbacks={{
          onError: ({message}) => {
            setErrorMessage(message);
          },
        }}
        config={loginConfig}
      />
    </section>
  );
}
