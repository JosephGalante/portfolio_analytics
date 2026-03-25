import {QueryClientProvider} from "@tanstack/react-query";
import {createElement} from "react";
import {render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {storeAuthSession} from "@/lib/auth";
import {createAppQueryClient} from "@/lib/query-client";

const apiMocks = vi.hoisted(() => ({
  createPortfolio: vi.fn(),
  getCurrentUser: vi.fn(),
  getPortfolio: vi.fn(),
  getValuation: vi.fn(),
  listHoldings: vi.fn(),
  listPortfolios: vi.fn(),
  listSnapshots: vi.fn(),
  registerUser: vi.fn(),
  upsertHolding: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMocks);

import Dashboard from "@/components/Dashboard";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  close = vi.fn();
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

const basePortfolio = {
  id: "portfolio-1",
  name: "Growth",
  created_at: "2026-03-24T12:00:00Z",
  updated_at: "2026-03-24T12:00:00Z",
};

describe("Dashboard", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    window.localStorage.clear();
    storeAuthSession({
      email: "tests@example.com",
      password: "password123",
    });

    apiMocks.createPortfolio.mockResolvedValue(basePortfolio);
    apiMocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "tests@example.com",
      name: "Test User",
    });
    apiMocks.upsertHolding.mockResolvedValue(undefined);
    apiMocks.listPortfolios.mockResolvedValue([basePortfolio]);
    apiMocks.getPortfolio.mockResolvedValue({
      ...basePortfolio,
      holdings_count: 1,
    });
    apiMocks.listHoldings.mockResolvedValue([]);
    apiMocks.listSnapshots.mockResolvedValue([]);
  });

  function renderDashboard() {
    const queryClient = createAppQueryClient();

    return render(
      createElement(
        QueryClientProvider,
        {client: queryClient},
        createElement(Dashboard),
      ),
    );
  }

  it("renders a loaded valuation", async () => {
    apiMocks.getValuation.mockResolvedValue({
      portfolio_id: "portfolio-1",
      total_market_value: "300.5",
      total_cost_basis: "200",
      unrealized_pnl: "100.5",
      holdings_count: 1,
      priced_holdings_count: 1,
      as_of: "2026-03-24T12:00:00Z",
    });

    renderDashboard();

    expect(await screen.findByText("Growth")).toBeTruthy();
    expect(await screen.findByText("$300.50")).toBeTruthy();
    expect(
      await screen.findByText(/PnL \$100\.50 across 1\/1 priced holdings\./),
    ).toBeTruthy();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("shows an error when valuation loading fails", async () => {
    apiMocks.getValuation.mockRejectedValue(
      new Error(
        "valuation.total_market_value must be a normalized decimal string.",
      ),
    );

    renderDashboard();

    expect(
      await screen.findByText(
        "valuation.total_market_value must be a normalized decimal string.",
      ),
    ).toBeTruthy();
  });
});
