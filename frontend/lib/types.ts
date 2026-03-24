export type Portfolio = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type PortfolioDetail = Portfolio & {
  holdings_count: number;
};

export type Holding = {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: string;
  average_cost_basis: string;
  created_at: string;
  updated_at: string;
};

export type PortfolioValuation = {
  portfolio_id: string;
  total_market_value: string;
  total_cost_basis: string;
  unrealized_pnl: string;
  holdings_count: number;
  priced_holdings_count: number;
  as_of: string;
};

export type PortfolioSnapshot = {
  id: string;
  portfolio_id: string;
  total_market_value: string;
  total_cost_basis: string;
  unrealized_pnl: string;
  captured_at: string;
};

export type CreatePortfolioPayload = {
  name: string;
};

export type UpsertHoldingPayload = {
  symbol: string;
  quantity: string;
  average_cost_basis: string;
};
