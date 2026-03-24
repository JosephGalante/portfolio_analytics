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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

  return response.json() as Promise<T>;
}

export function listPortfolios(): Promise<Portfolio[]> {
  return request<Portfolio[]>("/portfolios");
}

export function createPortfolio(
  payload: CreatePortfolioPayload,
): Promise<Portfolio> {
  return request<Portfolio>("/portfolios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPortfolio(portfolioId: string): Promise<PortfolioDetail> {
  return request<PortfolioDetail>(`/portfolios/${portfolioId}`);
}

export function listHoldings(portfolioId: string): Promise<Holding[]> {
  return request<Holding[]>(`/portfolios/${portfolioId}/holdings`);
}

export function upsertHolding(
  portfolioId: string,
  payload: UpsertHoldingPayload,
): Promise<Holding> {
  return request<Holding>(`/portfolios/${portfolioId}/holdings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getValuation(portfolioId: string): Promise<PortfolioValuation> {
  return request<PortfolioValuation>(`/portfolios/${portfolioId}/valuation`);
}

export function listSnapshots(
  portfolioId: string,
): Promise<PortfolioSnapshot[]> {
  return request<PortfolioSnapshot[]>(
    `/portfolios/${portfolioId}/snapshots?limit=10&offset=0`,
  );
}
