import {
  parseHoldingPayload,
  parseHoldingsPayload,
  parsePortfolioDetailPayload,
  parsePortfolioPayload,
  parsePortfoliosPayload,
  parsePortfolioSnapshotsPayload,
  parsePortfolioValuationPayload,
} from "./contracts";
import {
  CreatePortfolioPayload,
  Holding,
  Portfolio,
  PortfolioDetail,
  PortfolioSnapshot,
  PortfolioValuation,
  UpsertHoldingPayload,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function listPortfolios(): Promise<Portfolio[]> {
  return parsePortfoliosPayload(await request("/portfolios"));
}

export async function createPortfolio(
  payload: CreatePortfolioPayload,
): Promise<Portfolio> {
  return parsePortfolioPayload(
    await request("/portfolios", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function getPortfolio(
  portfolioId: string,
): Promise<PortfolioDetail> {
  return parsePortfolioDetailPayload(
    await request(`/portfolios/${portfolioId}`),
  );
}

export async function listHoldings(portfolioId: string): Promise<Holding[]> {
  return parseHoldingsPayload(
    await request(`/portfolios/${portfolioId}/holdings`),
  );
}

export async function upsertHolding(
  portfolioId: string,
  payload: UpsertHoldingPayload,
): Promise<Holding> {
  return parseHoldingPayload(
    await request(`/portfolios/${portfolioId}/holdings`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function getValuation(
  portfolioId: string,
): Promise<PortfolioValuation> {
  return parsePortfolioValuationPayload(
    await request(`/portfolios/${portfolioId}/valuation`),
  );
}

export async function listSnapshots(
  portfolioId: string,
): Promise<PortfolioSnapshot[]> {
  return parsePortfolioSnapshotsPayload(
    await request(`/portfolios/${portfolioId}/snapshots?limit=10&offset=0`),
  );
}
