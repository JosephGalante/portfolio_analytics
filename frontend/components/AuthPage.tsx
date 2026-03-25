"use client";

import {useQuery, useQueryClient} from "@tanstack/react-query";
import {useStytchSession} from "@stytch/nextjs";
import {useRouter} from "next/navigation";
import {useEffect} from "react";

import StytchAuthPanel from "@/components/StytchAuthPanel";
import {getCurrentUser} from "@/lib/api";
import {isStytchConfigured} from "@/lib/stytch";

const authQueryKey = ["auth", "me"] as const;

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AuthPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {isInitialized, session} = useStytchSession();
  const hasStytchSession = isInitialized && session !== null;
  const currentUserQuery = useQuery({
    queryKey: authQueryKey,
    queryFn: getCurrentUser,
    enabled: isStytchConfigured && hasStytchSession,
    retry: false,
  });

  useEffect(() => {
    if (currentUserQuery.data !== undefined) {
      router.replace("/");
    }
  }, [currentUserQuery.data, router]);

  useEffect(() => {
    if (!hasStytchSession) {
      queryClient.removeQueries({queryKey: authQueryKey});
    }
  }, [hasStytchSession, queryClient]);

  if (!isStytchConfigured) {
    return (
      <main className="shell auth-shell">
        <section className="panel auth-panel">
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>Stytch is required</h1>
          <p className="lede">
            Set `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` in your frontend env before
            using the app.
          </p>
        </section>
      </main>
    );
  }

  if (!isInitialized || (hasStytchSession && currentUserQuery.isLoading)) {
    return (
      <main className="shell auth-shell">
        <section className="panel auth-panel">
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>Authenticating your account...</h1>
          <p className="lede">
            Checking your Stytch session before loading the dashboard.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell auth-shell">
      <section className="auth-grid">
        <div>
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>
            Track portfolios in real time with owned portfolios and live private
            streams.
          </h1>
          <p className="lede">
            Email-first password onboarding lives here. Stytch sends the initial
            password setup email, then the backend verifies that Stytch session
            before loading your owned portfolios.
          </p>
        </div>

        <div className="feedback-stack">
          {hasStytchSession && currentUserQuery.error ? (
            <p className="error-banner">
              {toErrorMessage(
                currentUserQuery.error,
                "Failed to authenticate session.",
              )}
            </p>
          ) : null}
          <StytchAuthPanel />
        </div>
      </section>
    </main>
  );
}
