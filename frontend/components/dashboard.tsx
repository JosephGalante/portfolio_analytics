"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {FormEvent, useEffect, useMemo, useState} from "react";

import {
  createPortfolio,
  getCurrentUser,
  getPortfolio,
  getValuation,
  listHoldings,
  listPortfolios,
  listSnapshots,
  registerUser,
  upsertHolding,
} from "@/lib/api";
import {
  AuthSession,
  clearStoredAuthSession,
  encodeBasicAuth,
  getStoredAuthSession,
  storeAuthSession,
} from "@/lib/auth";
import StytchAuthPanel from "@/components/StytchAuthPanel";
import {parsePortfolioValuationPayload} from "@/lib/contracts";
import {isStytchConfigured} from "@/lib/stytch";
import {Portfolio} from "@/lib/types";

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";
const EMPTY_PORTFOLIOS: Portfolio[] = [];

const portfolioQueryKeys = {
  me: ["auth", "me"] as const,
  all: ["portfolios"] as const,
  detail: (portfolioId: string) =>
    ["portfolios", portfolioId, "detail"] as const,
  holdings: (portfolioId: string) =>
    ["portfolios", portfolioId, "holdings"] as const,
  valuation: (portfolioId: string) =>
    ["portfolios", portfolioId, "valuation"] as const,
  snapshots: (portfolioId: string) =>
    ["portfolios", portfolioId, "snapshots"] as const,
};

function formatMoney(value: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(
    null,
  );
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(
    null,
  );
  const [portfolioName, setPortfolioName] = useState("");
  const [holdingSymbol, setHoldingSymbol] = useState("AAPL");
  const [holdingQuantity, setHoldingQuantity] = useState("10");
  const [holdingCostBasis, setHoldingCostBasis] = useState("180.00");
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );
  const [actionSuccessMessage, setActionSuccessMessage] = useState<
    string | null
  >(null);
  const [realtimeErrorMessage, setRealtimeErrorMessage] = useState<
    string | null
  >(null);
  const [websocketStatus, setWebsocketStatus] = useState<
    "idle" | "connecting" | "live" | "error"
  >("idle");

  useEffect(() => {
    const storedAuthSession = getStoredAuthSession();
    if (storedAuthSession !== null) {
      setAuthSession(storedAuthSession);
      setAuthEmail(storedAuthSession.email);
      setAuthPassword(storedAuthSession.password);
    }
  }, []);

  const currentUserQuery = useQuery({
    queryKey: portfolioQueryKeys.me,
    queryFn: getCurrentUser,
    enabled: authSession !== null,
    retry: false,
  });

  useEffect(() => {
    if (
      authSession === null ||
      currentUserQuery.error === null ||
      currentUserQuery.error === undefined
    ) {
      return;
    }

    clearStoredAuthSession();
    setAuthSession(null);
    setSelectedPortfolioId(null);
    setAuthErrorMessage(
      toErrorMessage(currentUserQuery.error, "Invalid email or password."),
    );
    queryClient.removeQueries({queryKey: portfolioQueryKeys.me});
  }, [authSession, currentUserQuery.error, queryClient]);

  const portfoliosQuery = useQuery({
    queryKey: portfolioQueryKeys.all,
    queryFn: listPortfolios,
    enabled: currentUserQuery.data !== undefined,
  });

  const portfolios = portfoliosQuery.data ?? EMPTY_PORTFOLIOS;

  useEffect(() => {
    if (portfolios.length === 0) {
      if (selectedPortfolioId !== null) {
        setSelectedPortfolioId(null);
      }
      return;
    }

    if (
      selectedPortfolioId === null ||
      !portfolios.some((portfolio) => portfolio.id === selectedPortfolioId)
    ) {
      setSelectedPortfolioId(portfolios[0].id);
    }
  }, [portfolios, selectedPortfolioId]);

  useEffect(() => {
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    setRealtimeErrorMessage(null);
    setWebsocketStatus(selectedPortfolioId === null ? "idle" : "connecting");
  }, [selectedPortfolioId]);

  useEffect(() => {
    if (actionSuccessMessage === null && authSuccessMessage === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setActionSuccessMessage(null);
      setAuthSuccessMessage(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [actionSuccessMessage, authSuccessMessage]);

  const selectedPortfolio = useMemo(
    () =>
      portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ??
      null,
    [portfolios, selectedPortfolioId],
  );

  const portfolioDetailQuery = useQuery({
    queryKey:
      selectedPortfolioId === null
        ? ["portfolios", "none", "detail"]
        : portfolioQueryKeys.detail(selectedPortfolioId),
    queryFn: () => getPortfolio(selectedPortfolioId as string),
    enabled:
      selectedPortfolioId !== null && currentUserQuery.data !== undefined,
  });

  const holdingsQuery = useQuery({
    queryKey:
      selectedPortfolioId === null
        ? ["portfolios", "none", "holdings"]
        : portfolioQueryKeys.holdings(selectedPortfolioId),
    queryFn: () => listHoldings(selectedPortfolioId as string),
    enabled:
      selectedPortfolioId !== null && currentUserQuery.data !== undefined,
  });

  const valuationQuery = useQuery({
    queryKey:
      selectedPortfolioId === null
        ? ["portfolios", "none", "valuation"]
        : portfolioQueryKeys.valuation(selectedPortfolioId),
    queryFn: () => getValuation(selectedPortfolioId as string),
    enabled:
      selectedPortfolioId !== null && currentUserQuery.data !== undefined,
  });

  const snapshotsQuery = useQuery({
    queryKey:
      selectedPortfolioId === null
        ? ["portfolios", "none", "snapshots"]
        : portfolioQueryKeys.snapshots(selectedPortfolioId),
    queryFn: () => listSnapshots(selectedPortfolioId as string),
    enabled:
      selectedPortfolioId !== null && currentUserQuery.data !== undefined,
  });

  const registerMutation = useMutation({
    mutationFn: registerUser,
    onMutate: () => {
      setAuthErrorMessage(null);
      setAuthSuccessMessage(null);
    },
    onSuccess: (_, variables) => {
      const nextAuthSession = {
        email: variables.email,
        password: variables.password,
      };
      storeAuthSession(nextAuthSession);
      setAuthSession(nextAuthSession);
      setAuthEmail(variables.email);
      setAuthPassword(variables.password);
      setAuthName("");
      setAuthMode("signin");
      setAuthSuccessMessage(`Registered ${variables.email}.`);
    },
    onError: (error) => {
      setAuthErrorMessage(toErrorMessage(error, "Failed to register user."));
    },
  });

  const createPortfolioMutation = useMutation({
    mutationFn: createPortfolio,
    onMutate: () => {
      setActionErrorMessage(null);
      setActionSuccessMessage(null);
    },
    onSuccess: async (portfolio) => {
      setPortfolioName("");
      setSelectedPortfolioId(portfolio.id);
      setActionSuccessMessage(`Created portfolio "${portfolio.name}".`);
      queryClient.setQueryData<Portfolio[]>(
        portfolioQueryKeys.all,
        (current) => {
          const next = current ?? [];

          if (next.some((item) => item.id === portfolio.id)) {
            return next;
          }

          return [...next, portfolio];
        },
      );
      await queryClient.invalidateQueries({queryKey: portfolioQueryKeys.all});
    },
    onError: (error) => {
      setActionErrorMessage(
        toErrorMessage(error, "Failed to create portfolio."),
      );
    },
  });

  const upsertHoldingMutation = useMutation({
    mutationFn: ({
      portfolioId,
      symbol,
      quantity,
      averageCostBasis,
    }: {
      portfolioId: string;
      symbol: string;
      quantity: string;
      averageCostBasis: string;
    }) =>
      upsertHolding(portfolioId, {
        symbol,
        quantity,
        average_cost_basis: averageCostBasis,
      }),
    onMutate: () => {
      setActionErrorMessage(null);
      setActionSuccessMessage(null);
    },
    onSuccess: async (_, variables) => {
      setActionSuccessMessage(
        `Saved ${variables.symbol.toUpperCase()} holding and refreshed portfolio data.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: portfolioQueryKeys.detail(variables.portfolioId),
        }),
        queryClient.invalidateQueries({
          queryKey: portfolioQueryKeys.holdings(variables.portfolioId),
        }),
        queryClient.invalidateQueries({
          queryKey: portfolioQueryKeys.valuation(variables.portfolioId),
        }),
        queryClient.invalidateQueries({
          queryKey: portfolioQueryKeys.snapshots(variables.portfolioId),
        }),
      ]);
    },
    onError: (error) => {
      setActionErrorMessage(toErrorMessage(error, "Failed to save holding."));
    },
  });

  useEffect(() => {
    if (selectedPortfolioId === null || authSession === null) {
      setWebsocketStatus("idle");
      return;
    }

    setWebsocketStatus("connecting");
    const websocket = new WebSocket(
      `${WS_BASE_URL}/ws/portfolios/${selectedPortfolioId}?authorization=${encodeURIComponent(
        encodeBasicAuth(authSession),
      )}`,
    );

    websocket.onopen = () => {
      setWebsocketStatus("live");
      setRealtimeErrorMessage(null);
    };

    websocket.onmessage = (event) => {
      try {
        const nextValuation = parsePortfolioValuationPayload(
          JSON.parse(event.data),
        );

        setRealtimeErrorMessage(null);
        queryClient.setQueryData(
          portfolioQueryKeys.valuation(selectedPortfolioId),
          nextValuation,
        );
        void queryClient.invalidateQueries({
          queryKey: portfolioQueryKeys.snapshots(selectedPortfolioId),
        });
      } catch (error) {
        setRealtimeErrorMessage(
          toErrorMessage(error, "Failed to process valuation update."),
        );
      }
    };

    websocket.onerror = () => {
      setWebsocketStatus("error");
      setRealtimeErrorMessage("Websocket connection failed.");
    };

    return () => {
      websocket.close();
    };
  }, [authSession, queryClient, selectedPortfolioId]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthErrorMessage(null);
    setAuthSuccessMessage(null);
    const nextAuthSession = {
      email: authEmail.trim().toLowerCase(),
      password: authPassword,
    };
    storeAuthSession(nextAuthSession);
    setAuthSession(nextAuthSession);
    queryClient.removeQueries({queryKey: portfolioQueryKeys.me});
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await registerMutation.mutateAsync({
      email: authEmail.trim().toLowerCase(),
      name: authName.trim(),
      password: authPassword,
    });
  }

  function handleSignOut() {
    clearStoredAuthSession();
    setAuthSession(null);
    setSelectedPortfolioId(null);
    setAuthPassword("");
    setAuthName("");
    setAuthErrorMessage(null);
    setAuthSuccessMessage(null);
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    setRealtimeErrorMessage(null);
    queryClient.clear();
  }

  async function handleCreatePortfolio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createPortfolioMutation.mutateAsync({name: portfolioName});
  }

  async function handleUpsertHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedPortfolioId === null) {
      return;
    }

    await upsertHoldingMutation.mutateAsync({
      portfolioId: selectedPortfolioId,
      symbol: holdingSymbol,
      quantity: holdingQuantity,
      averageCostBasis: holdingCostBasis,
    });
  }

  async function handleRefreshSelectedPortfolio() {
    if (selectedPortfolioId === null) {
      return;
    }

    setActionErrorMessage(null);
    setRealtimeErrorMessage(null);

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: portfolioQueryKeys.detail(selectedPortfolioId),
      }),
      queryClient.invalidateQueries({
        queryKey: portfolioQueryKeys.holdings(selectedPortfolioId),
      }),
      queryClient.invalidateQueries({
        queryKey: portfolioQueryKeys.valuation(selectedPortfolioId),
      }),
      queryClient.invalidateQueries({
        queryKey: portfolioQueryKeys.snapshots(selectedPortfolioId),
      }),
    ]);
  }

  if (authSession === null || currentUserQuery.isError) {
    return (
      <main className="shell auth-shell">
        <section className="auth-grid">
          <div>
            <p className="eyebrow">Portfolio Analytics MVP</p>
            <h1>
              Track portfolios in real time with owned portfolios and live
              private streams.
            </h1>
            <p className="lede">
              {isStytchConfigured
                ? "This first Stytch step only replaces the frontend sign-in flow with email magic links. The backend ownership checks are still on the legacy local auth path until the next migration."
                : "Sign in with HTTP Basic credentials to access only your own portfolios, holdings, valuations, and websocket updates."}
            </p>
          </div>

          {isStytchConfigured ? (
            <StytchAuthPanel />
          ) : (
            <section className="panel auth-panel">
              <div className="panel-header">
                <h2>{authMode === "signin" ? "Sign in" : "Register"}</h2>
                <span>
                  {authMode === "signin" ? "Existing user" : "New owner"}
                </span>
              </div>

              {authErrorMessage ? (
                <p className="error-banner">{authErrorMessage}</p>
              ) : null}
              {authSuccessMessage ? (
                <p className="success-banner">{authSuccessMessage}</p>
              ) : null}

              <form
                className="stack-form"
                onSubmit={authMode === "signin" ? handleSignIn : handleRegister}
              >
                <label>
                  <span>Email</span>
                  <input
                    autoComplete="username"
                    onChange={(event) => setAuthEmail(event.target.value)}
                    required
                    type="email"
                    value={authEmail}
                  />
                </label>
                {authMode === "register" ? (
                  <label>
                    <span>Name</span>
                    <input
                      onChange={(event) => setAuthName(event.target.value)}
                      required
                      value={authName}
                    />
                  </label>
                ) : null}
                <label>
                  <span>Password</span>
                  <input
                    autoComplete={
                      authMode === "signin"
                        ? "current-password"
                        : "new-password"
                    }
                    minLength={8}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    required
                    type="password"
                    value={authPassword}
                  />
                </label>
                <button
                  disabled={
                    registerMutation.isPending || currentUserQuery.isFetching
                  }
                  type="submit"
                >
                  {authMode === "signin"
                    ? currentUserQuery.isFetching
                      ? "Signing in..."
                      : "Sign in"
                    : registerMutation.isPending
                      ? "Registering..."
                      : "Register"}
                </button>
              </form>

              <button
                className="ghost-button"
                onClick={() => {
                  setAuthErrorMessage(null);
                  setAuthSuccessMessage(null);
                  setAuthMode(authMode === "signin" ? "register" : "signin");
                }}
                type="button"
              >
                {authMode === "signin"
                  ? "Need an account? Register"
                  : "Already have an account? Sign in"}
              </button>
            </section>
          )}
        </section>
      </main>
    );
  }

  if (currentUserQuery.isLoading) {
    return (
      <main className="shell auth-shell">
        <section className="panel auth-panel">
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>Authenticating your account...</h1>
          <p className="lede">
            Loading your owned portfolios and live stream access.
          </p>
        </section>
      </main>
    );
  }

  const currentUser = currentUserQuery.data;
  if (currentUser === undefined) {
    return null;
  }

  const isRefreshing =
    createPortfolioMutation.isPending ||
    upsertHoldingMutation.isPending ||
    portfoliosQuery.isFetching ||
    portfolioDetailQuery.isFetching ||
    holdingsQuery.isFetching ||
    valuationQuery.isFetching ||
    snapshotsQuery.isFetching;

  const portfolioDetail = portfolioDetailQuery.data ?? null;
  const holdings = holdingsQuery.data ?? [];
  const valuation = valuationQuery.data ?? null;
  const snapshots = snapshotsQuery.data ?? [];
  const streamStatusLabel =
    websocketStatus === "live"
      ? "Live feed connected"
      : websocketStatus === "connecting"
        ? "Connecting live feed"
        : websocketStatus === "error"
          ? "Live feed unavailable"
          : "Awaiting portfolio";
  const currentMode =
    websocketStatus === "error"
      ? "Degraded"
      : websocketStatus === "connecting"
        ? "Connecting"
        : isRefreshing
          ? "Refreshing"
          : "Streaming";

  const errorMessage =
    actionErrorMessage ??
    realtimeErrorMessage ??
    portfoliosQuery.error?.message ??
    portfolioDetailQuery.error?.message ??
    holdingsQuery.error?.message ??
    valuationQuery.error?.message ??
    snapshotsQuery.error?.message ??
    null;

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>
            Event-driven portfolio monitoring with live valuation updates.
          </h1>
          <p className="lede">
            Signed in as <strong>{currentUser.name}</strong> (
            {currentUser.email}). FastAPI serves the portfolio APIs, Redis
            handles tick propagation and cache reads, and the dashboard listens
            for websocket pushes as valuations change.
          </p>
        </div>
        <div className="hero-card">
          <span>Live Stack</span>
          <strong>API + Worker + Simulator + Redis + Postgres</strong>
          <p>Current mode: {currentMode}</p>
          <div className="status-chip-row">
            <span
              className={
                websocketStatus === "live"
                  ? "status-chip live"
                  : websocketStatus === "error"
                    ? "status-chip error"
                    : "status-chip muted"
              }
            >
              {streamStatusLabel}
            </span>
          </div>
          <button
            className="ghost-button auth-signout"
            onClick={handleSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </section>

      {errorMessage || actionSuccessMessage ? (
        <div className="feedback-stack">
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
          {actionSuccessMessage ? (
            <p className="success-banner">{actionSuccessMessage}</p>
          ) : null}
        </div>
      ) : null}

      <section className="grid">
        <aside className="panel sidebar">
          <div className="panel-header">
            <h2>Portfolios</h2>
            <span>{portfolios.length}</span>
          </div>

          <form className="stack-form" onSubmit={handleCreatePortfolio}>
            <label>
              <span>New portfolio</span>
              <input
                value={portfolioName}
                onChange={(event) => setPortfolioName(event.target.value)}
                placeholder="Long-term growth"
                required
              />
            </label>
            <button type="submit" disabled={createPortfolioMutation.isPending}>
              {createPortfolioMutation.isPending
                ? "Creating..."
                : "Create portfolio"}
            </button>
          </form>

          <div className="portfolio-list">
            {portfolios.map((portfolio) => (
              <button
                key={portfolio.id}
                className={
                  portfolio.id === selectedPortfolioId
                    ? "portfolio-card active"
                    : "portfolio-card"
                }
                onClick={() => setSelectedPortfolioId(portfolio.id)}
                type="button"
              >
                <strong>{portfolio.name}</strong>
                <span>{formatTimestamp(portfolio.created_at)}</span>
              </button>
            ))}
            {portfolios.length === 0 && portfoliosQuery.isLoading ? (
              <p className="empty">Loading portfolios...</p>
            ) : portfolios.length === 0 ? (
              <p className="empty">Create a portfolio to begin.</p>
            ) : null}
          </div>
        </aside>

        <section className="content">
          <div className="summary-grid">
            <article className="panel metric-panel">
              <div className="panel-header">
                <h2>Selected portfolio</h2>
                <span>{selectedPortfolio ? "Owned" : "Idle"}</span>
              </div>
              {portfolioDetail ? (
                <>
                  <strong className="metric-value">
                    {portfolioDetail.name}
                  </strong>
                  <p className="metric-note">
                    {portfolioDetail.holdings_count} holdings tracked in this
                    portfolio.
                  </p>
                </>
              ) : selectedPortfolioId && portfolioDetailQuery.isLoading ? (
                <p className="empty">Loading portfolio details...</p>
              ) : (
                <p className="empty">No portfolio selected.</p>
              )}
            </article>

            <article className="panel metric-panel accent">
              <div className="panel-header">
                <h2>Current valuation</h2>
                <div className="panel-header-actions">
                  <span>
                    {valuation ? formatTimestamp(valuation.as_of) : "No data"}
                  </span>
                  <button
                    className="secondary-button"
                    disabled={selectedPortfolioId === null || isRefreshing}
                    onClick={() => {
                      void handleRefreshSelectedPortfolio();
                    }}
                    type="button"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <p className="status-line">{streamStatusLabel}</p>
              {valuation ? (
                <>
                  <strong className="metric-value">
                    {formatMoney(valuation.total_market_value)}
                  </strong>
                  <p className="metric-note">
                    PnL {formatMoney(valuation.unrealized_pnl)} across{" "}
                    {valuation.priced_holdings_count}/{valuation.holdings_count}{" "}
                    priced holdings.
                  </p>
                </>
              ) : selectedPortfolioId && valuationQuery.isLoading ? (
                <p className="empty">Loading latest valuation...</p>
              ) : (
                <p className="empty">Waiting for prices or holdings.</p>
              )}
            </article>
          </div>

          <div className="content-grid">
            <section className="panel">
              <div className="panel-header">
                <h2>Holdings</h2>
                <span>{holdings.length}</span>
              </div>

              <form className="holding-form" onSubmit={handleUpsertHolding}>
                <label>
                  <span>Symbol</span>
                  <input
                    value={holdingSymbol}
                    onChange={(event) =>
                      setHoldingSymbol(event.target.value.toUpperCase())
                    }
                    required
                  />
                </label>
                <label>
                  <span>Quantity</span>
                  <input
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    value={holdingQuantity}
                    onChange={(event) => setHoldingQuantity(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Average cost basis</span>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={holdingCostBasis}
                    onChange={(event) =>
                      setHoldingCostBasis(event.target.value)
                    }
                    required
                  />
                </label>
                <button type="submit" disabled={selectedPortfolioId === null}>
                  {upsertHoldingMutation.isPending
                    ? "Saving..."
                    : "Save holding"}
                </button>
              </form>

              <div className="table-list">
                {holdings.map((holding) => (
                  <div className="row" key={holding.id}>
                    <strong>{holding.symbol}</strong>
                    <span>{holding.quantity} shares</span>
                    <span>{formatMoney(holding.average_cost_basis)}</span>
                  </div>
                ))}
                {holdings.length === 0 && holdingsQuery.isLoading ? (
                  <p className="empty">Loading holdings...</p>
                ) : holdings.length === 0 ? (
                  <p className="empty">
                    No holdings yet. Add one to enable valuation updates.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Recent snapshots</h2>
                <span>{snapshots.length}</span>
              </div>
              <div className="table-list">
                {snapshots.map((snapshot) => (
                  <div className="row" key={snapshot.id}>
                    <strong>{formatMoney(snapshot.total_market_value)}</strong>
                    <span>{formatMoney(snapshot.unrealized_pnl)} PnL</span>
                    <span>{formatTimestamp(snapshot.captured_at)}</span>
                  </div>
                ))}
                {snapshots.length === 0 && snapshotsQuery.isLoading ? (
                  <p className="empty">Loading snapshots...</p>
                ) : snapshots.length === 0 ? (
                  <p className="empty">
                    Snapshots will appear after price ticks revalue the
                    portfolio.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
