import {
  parseUserPayload,
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
  RegisterPayload,
  User,
  UpsertHoldingPayload,
} from "./types";
import {encodeBasicAuth, getStoredAuthSession} from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const authSession = getStoredAuthSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authSession ? {Authorization: encodeBasicAuth(authSession)} : {}),
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

export async function getCurrentUser(): Promise<User> {
  return parseUserPayload(await request("/auth/me"));
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  return parseUserPayload(
    await request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
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
