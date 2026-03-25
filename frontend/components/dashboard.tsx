"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {FormEvent, useEffect, useMemo, useState} from "react";

import {
  createPortfolio,
  getPortfolio,
  getValuation,
  listHoldings,
  listPortfolios,
  listSnapshots,
  upsertHolding,
} from "../lib/api";
import {parsePortfolioValuationPayload} from "../lib/contracts";
import {Portfolio} from "../lib/types";

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";
const EMPTY_PORTFOLIOS: Portfolio[] = [];

const portfolioQueryKeys = {
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

export function Dashboard() {
  const queryClient = useQueryClient();
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
  const [realtimeErrorMessage, setRealtimeErrorMessage] = useState<
    string | null
  >(null);

  const portfoliosQuery = useQuery({
    queryKey: portfolioQueryKeys.all,
    queryFn: listPortfolios,
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
    setRealtimeErrorMessage(null);
  }, [selectedPortfolioId]);

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
    enabled: selectedPortfolioId !== null,
  });

  const holdingsQuery = useQuery({
    queryKey:
      selectedPortfolioId === null
        ? ["portfolios", "none", "holdings"]
        : portfolioQueryKeys.holdings(selectedPortfolioId),
    queryFn: () => listHoldings(selectedPortfolioId as string),
    enabled: selectedPortfolioId !== null,
  });

  const valuationQuery = useQuery({
    queryKey:
      selectedPortfolioId === null
        ? ["portfolios", "none", "valuation"]
        : portfolioQueryKeys.valuation(selectedPortfolioId),
    queryFn: () => getValuation(selectedPortfolioId as string),
    enabled: selectedPortfolioId !== null,
  });

  const snapshotsQuery = useQuery({
    queryKey:
      selectedPortfolioId === null
        ? ["portfolios", "none", "snapshots"]
        : portfolioQueryKeys.snapshots(selectedPortfolioId),
    queryFn: () => listSnapshots(selectedPortfolioId as string),
    enabled: selectedPortfolioId !== null,
  });

  const createPortfolioMutation = useMutation({
    mutationFn: createPortfolio,
    onMutate: () => {
      setActionErrorMessage(null);
    },
    onSuccess: async (portfolio) => {
      setPortfolioName("");
      setSelectedPortfolioId(portfolio.id);
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
      average_cost_basis,
    }: {
      portfolioId: string;
      symbol: string;
      quantity: string;
      average_cost_basis: string;
    }) =>
      upsertHolding(portfolioId, {
        symbol,
        quantity,
        average_cost_basis,
      }),
    onMutate: () => {
      setActionErrorMessage(null);
    },
    onSuccess: async (_, variables) => {
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
    if (selectedPortfolioId === null) {
      return;
    }

    const websocket = new WebSocket(
      `${WS_BASE_URL}/ws/portfolios/${selectedPortfolioId}`,
    );

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
      setRealtimeErrorMessage("Websocket connection failed.");
    };

    return () => {
      websocket.close();
    };
  }, [queryClient, selectedPortfolioId]);

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
      average_cost_basis: holdingCostBasis,
    });
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
            FastAPI serves the portfolio APIs, Redis handles tick propagation
            and cache reads, and the dashboard listens for websocket pushes as
            valuations change.
          </p>
        </div>
        <div className="hero-card">
          <span>Live Stack</span>
          <strong>API + Worker + Simulator + Redis + Postgres</strong>
          <p>Current mode: {isRefreshing ? "Refreshing" : "Streaming"}</p>
        </div>
      </section>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

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
            <button type="submit">Create portfolio</button>
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
            {portfolios.length === 0 ? (
              <p className="empty">Create a portfolio to begin.</p>
            ) : null}
          </div>
        </aside>

        <section className="content">
          <div className="summary-grid">
            <article className="panel metric-panel">
              <div className="panel-header">
                <h2>Selected portfolio</h2>
                <span>{selectedPortfolio ? "Live" : "Idle"}</span>
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
              ) : (
                <p className="empty">No portfolio selected.</p>
              )}
            </article>

            <article className="panel metric-panel accent">
              <div className="panel-header">
                <h2>Current valuation</h2>
                <span>
                  {valuation ? formatTimestamp(valuation.as_of) : "No data"}
                </span>
              </div>
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
                  Save holding
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
                {holdings.length === 0 ? (
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
                {snapshots.length === 0 ? (
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
