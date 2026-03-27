'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useStytchSession} from '@stytch/nextjs';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';

import StytchAuthPanel from '@/components/StytchAuthPanel';
import {createGuestSession, getCurrentUser} from '@/lib/api';
import {
  clearStoredGuestSessionToken,
  getStoredGuestSessionToken,
  isGuestDemoConfigured,
  storeGuestSessionToken,
} from '@/lib/auth';
import {isStytchConfigured} from '@/lib/stytch';

const authQueryKey = ['auth', 'me'] as const;

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

type SharedAuthPageProps = {
  guestToken: string | null;
  isHydrated: boolean;
  setGuestToken: (value: string | null) => void;
};

function AuthMarketingCopy() {
  return (
    <div>
      <p className="eyebrow">Portfolio Analytics MVP</p>
      <h1>
        Event-driven portfolio monitoring with a guest demo and owned accounts.
      </h1>
      <p className="lede">
        The guest path opens a seeded read-only portfolio immediately so a
        reviewer can see live valuation updates with minimal friction. The full
        Stytch password flow is still available for the deeper product story.
      </p>
    </div>
  );
}

type GuestDemoCardProps = {
  errorMessage: string | null;
  isPending: boolean;
  onStart: () => void;
};

function GuestDemoCard({errorMessage, isPending, onStart}: GuestDemoCardProps) {
  if (!isGuestDemoConfigured) {
    return null;
  }

  return (
    <section className="panel auth-panel">
      <div className="auth-card-head">
        <div>
          <p className="eyebrow">Guest demo</p>
          <h2>Open a seeded live portfolio</h2>
        </div>
        <span className="status-chip muted">Read-only</span>
      </div>
      <p className="lede">
        Skip inbox setup. Load two seeded portfolios backed by the same
        valuation, Redis, and websocket pipeline as the authenticated product.
      </p>
      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
      <button disabled={isPending} onClick={onStart} type="button">
        {isPending ? 'Opening guest demo...' : 'Try guest demo'}
      </button>
    </section>
  );
}

function useGuestSessionMutation(setGuestToken: (value: string | null) => void) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGuestSession,
    onSuccess: (payload) => {
      storeGuestSessionToken(payload.access_token);
      setGuestToken(payload.access_token);
      queryClient.setQueryData(authQueryKey, payload.user);
      router.replace('/');
    },
  });
}

function AuthPageGuestOnly({
  guestToken,
  isHydrated,
  setGuestToken,
}: SharedAuthPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [guestErrorMessage, setGuestErrorMessage] = useState<string | null>(
    null,
  );
  const guestSessionMutation = useGuestSessionMutation(setGuestToken);
  const currentUserQuery = useQuery({
    queryKey: authQueryKey,
    queryFn: getCurrentUser,
    enabled: isHydrated && guestToken !== null,
    retry: false,
  });

  useEffect(() => {
    if (currentUserQuery.data !== undefined) {
      router.replace('/');
    }
  }, [currentUserQuery.data, router]);

  useEffect(() => {
    if (guestToken === null) {
      queryClient.removeQueries({queryKey: authQueryKey});
      return;
    }

    if (currentUserQuery.error === null || currentUserQuery.error === undefined) {
      return;
    }

    clearStoredGuestSessionToken();
    setGuestToken(null);
    setGuestErrorMessage(
      toErrorMessage(currentUserQuery.error, 'Failed to restore guest demo.'),
    );
    queryClient.removeQueries({queryKey: authQueryKey});
  }, [currentUserQuery.error, guestToken, queryClient, setGuestToken]);

  return (
    <main className="shell auth-shell">
      <section className="auth-grid">
        <AuthMarketingCopy />

        <div className="feedback-stack">
          <GuestDemoCard
            errorMessage={
              guestErrorMessage ??
              (guestSessionMutation.error
                ? toErrorMessage(
                    guestSessionMutation.error,
                    'Failed to open guest demo.',
                  )
                : null)
            }
            isPending={guestSessionMutation.isPending}
            onStart={() => {
              setGuestErrorMessage(null);
              guestSessionMutation.mutate();
            }}
          />
          <section className="panel auth-panel">
            <p className="eyebrow">Sign in</p>
            <h2>Stytch not configured in this environment</h2>
            <p className="lede">
              The guest demo is available, but password sign-in is disabled
              until the frontend gets a Stytch public token.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function AuthPageWithStytch({
  guestToken,
  isHydrated,
  setGuestToken,
}: SharedAuthPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {isInitialized, session} = useStytchSession();
  const hasStytchSession = isInitialized && session !== null;
  const hasAnySession = guestToken !== null || hasStytchSession;
  const [guestErrorMessage, setGuestErrorMessage] = useState<string | null>(
    null,
  );
  const guestSessionMutation = useGuestSessionMutation(setGuestToken);
  const currentUserQuery = useQuery({
    queryKey: authQueryKey,
    queryFn: getCurrentUser,
    enabled: isHydrated && hasAnySession,
    retry: false,
  });

  useEffect(() => {
    if (currentUserQuery.data !== undefined) {
      router.replace('/');
    }
  }, [currentUserQuery.data, router]);

  useEffect(() => {
    if (!hasAnySession) {
      queryClient.removeQueries({queryKey: authQueryKey});
      return;
    }

    if (
      guestToken !== null &&
      currentUserQuery.error !== null &&
      currentUserQuery.error !== undefined
    ) {
      clearStoredGuestSessionToken();
      setGuestToken(null);
      setGuestErrorMessage(
        toErrorMessage(currentUserQuery.error, 'Failed to restore guest demo.'),
      );
      queryClient.removeQueries({queryKey: authQueryKey});
    }
  }, [
    currentUserQuery.error,
    guestToken,
    hasAnySession,
    queryClient,
    setGuestToken,
  ]);

  if (!isHydrated || (!isInitialized && guestToken === null)) {
    return (
      <main className="shell auth-shell">
        <section className="panel auth-panel">
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>Checking your session...</h1>
          <p className="lede">
            Restoring guest or Stytch access before loading the dashboard.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell auth-shell">
      <section className="auth-grid">
        <AuthMarketingCopy />

        <div className="feedback-stack">
          <GuestDemoCard
            errorMessage={
              guestErrorMessage ??
              (guestSessionMutation.error
                ? toErrorMessage(
                    guestSessionMutation.error,
                    'Failed to open guest demo.',
                  )
                : null)
            }
            isPending={guestSessionMutation.isPending}
            onStart={() => {
              setGuestErrorMessage(null);
              guestSessionMutation.mutate();
            }}
          />

          <section className="panel auth-panel">
            <p className="eyebrow">Sign in</p>
            <h2>Use the full authenticated product flow</h2>
            <p className="lede">
              Stytch handles password setup and session issuance. The backend
              verifies the Stytch session before loading your owned portfolios.
            </p>
            {hasStytchSession && currentUserQuery.error ? (
              <p className="error-banner">
                {toErrorMessage(
                  currentUserQuery.error,
                  'Failed to authenticate session.',
                )}
              </p>
            ) : null}
            <StytchAuthPanel />
          </section>
        </div>
      </section>
    </main>
  );
}

export default function AuthPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);

  useEffect(() => {
    setGuestToken(getStoredGuestSessionToken());
    setIsHydrated(true);
  }, []);

  if (!isStytchConfigured) {
    return (
      <AuthPageGuestOnly
        guestToken={guestToken}
        isHydrated={isHydrated}
        setGuestToken={setGuestToken}
      />
    );
  }

  return (
    <AuthPageWithStytch
      guestToken={guestToken}
      isHydrated={isHydrated}
      setGuestToken={setGuestToken}
    />
  );
}
