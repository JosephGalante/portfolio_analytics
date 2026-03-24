"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";

import {
  createPortfolio,
  getPortfolio,
  getValuation,
  listHoldings,
  listPortfolios,
  listSnapshots,
  upsertHolding,
} from "../lib/api";
import {
  Holding,
  Portfolio,
  PortfolioDetail,
  PortfolioSnapshot,
  PortfolioValuation,
} from "../lib/types";

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";

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

export function Dashboard() {
  const [isPending, startTransition] = useTransition();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [portfolioDetail, setPortfolioDetail] = useState<PortfolioDetail | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [portfolioName, setPortfolioName] = useState("");
  const [holdingSymbol, setHoldingSymbol] = useState("AAPL");
  const [holdingQuantity, setHoldingQuantity] = useState("10");
  const [holdingCostBasis, setHoldingCostBasis] = useState("180.00");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null,
    [portfolios, selectedPortfolioId],
  );

  async function refreshPortfolios(preferredPortfolioId?: string) {
    const nextPortfolios = await listPortfolios();
    startTransition(() => {
      setPortfolios(nextPortfolios);
      if (nextPortfolios.length === 0) {
        setSelectedPortfolioId(null);
        return;
      }

      const targetId =
        preferredPortfolioId && nextPortfolios.some((portfolio) => portfolio.id === preferredPortfolioId)
          ? preferredPortfolioId
          : selectedPortfolioId && nextPortfolios.some((portfolio) => portfolio.id === selectedPortfolioId)
            ? selectedPortfolioId
            : nextPortfolios[0].id;

      setSelectedPortfolioId(targetId);
    });
  }

  async function refreshSelectedPortfolio(portfolioId: string) {
    const [detail, nextHoldings, nextValuation, nextSnapshots] = await Promise.all([
      getPortfolio(portfolioId),
      listHoldings(portfolioId),
      getValuation(portfolioId),
      listSnapshots(portfolioId),
    ]);

    startTransition(() => {
      setPortfolioDetail(detail);
      setHoldings(nextHoldings);
      setValuation(nextValuation);
      setSnapshots(nextSnapshots);
    });
  }

  useEffect(() => {
    refreshPortfolios().catch((error: Error) => setErrorMessage(error.message));
  }, []);

  useEffect(() => {
    if (!selectedPortfolioId) {
      startTransition(() => {
        setPortfolioDetail(null);
        setHoldings([]);
        setValuation(null);
        setSnapshots([]);
      });
      return;
    }

    refreshSelectedPortfolio(selectedPortfolioId).catch((error: Error) => {
      setErrorMessage(error.message);
    });
  }, [selectedPortfolioId]);

  useEffect(() => {
    if (!selectedPortfolioId) {
      return;
    }

    const websocket = new WebSocket(`${WS_BASE_URL}/ws/portfolios/${selectedPortfolioId}`);
    websocket.onmessage = (event) => {
      const nextValuation = JSON.parse(event.data) as PortfolioValuation;
      startTransition(() => {
        setValuation(nextValuation);
      });

      listSnapshots(selectedPortfolioId)
        .then((nextSnapshots) => {
          startTransition(() => {
            setSnapshots(nextSnapshots);
          });
        })
        .catch((error: Error) => setErrorMessage(error.message));
    };
    websocket.onerror = () => {
      setErrorMessage("Websocket connection failed.");
    };

    return () => {
      websocket.close();
    };
  }, [selectedPortfolioId]);

  async function handleCreatePortfolio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      const portfolio = await createPortfolio({ name: portfolioName });
      setPortfolioName("");
      await refreshPortfolios(portfolio.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create portfolio.");
    }
  }

  async function handleUpsertHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPortfolioId) {
      return;
    }
    setErrorMessage(null);

    try {
      await upsertHolding(selectedPortfolioId, {
        symbol: holdingSymbol,
        quantity: holdingQuantity,
        average_cost_basis: holdingCostBasis,
      });
      await refreshSelectedPortfolio(selectedPortfolioId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save holding.");
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>Event-driven portfolio monitoring with live valuation updates.</h1>
          <p className="lede">
            FastAPI serves the portfolio APIs, Redis handles tick propagation and cache reads, and
            the dashboard listens for websocket pushes as valuations change.
          </p>
        </div>
        <div className="hero-card">
          <span>Live Stack</span>
          <strong>API + Worker + Simulator + Redis + Postgres</strong>
          <p>Current mode: {isPending ? "Refreshing" : "Streaming"}</p>
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
                className={portfolio.id === selectedPortfolioId ? "portfolio-card active" : "portfolio-card"}
                onClick={() => setSelectedPortfolioId(portfolio.id)}
                type="button"
              >
                <strong>{portfolio.name}</strong>
                <span>{formatTimestamp(portfolio.created_at)}</span>
              </button>
            ))}
            {portfolios.length === 0 ? <p className="empty">Create a portfolio to begin.</p> : null}
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
                  <strong className="metric-value">{portfolioDetail.name}</strong>
                  <p className="metric-note">
                    {portfolioDetail.holdings_count} holdings tracked in this portfolio.
                  </p>
                </>
              ) : (
                <p className="empty">No portfolio selected.</p>
              )}
            </article>

            <article className="panel metric-panel accent">
              <div className="panel-header">
                <h2>Current valuation</h2>
                <span>{valuation ? formatTimestamp(valuation.as_of) : "No data"}</span>
              </div>
              {valuation ? (
                <>
                  <strong className="metric-value">{formatMoney(valuation.total_market_value)}</strong>
                  <p className="metric-note">
                    PnL {formatMoney(valuation.unrealized_pnl)} across {valuation.priced_holdings_count}/
                    {valuation.holdings_count} priced holdings.
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
                    onChange={(event) => setHoldingSymbol(event.target.value.toUpperCase())}
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
                    onChange={(event) => setHoldingCostBasis(event.target.value)}
                    required
                  />
                </label>
                <button type="submit" disabled={!selectedPortfolioId}>
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
                  <p className="empty">No holdings yet. Add one to enable valuation updates.</p>
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
                  <p className="empty">Snapshots will appear after price ticks revalue the portfolio.</p>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
