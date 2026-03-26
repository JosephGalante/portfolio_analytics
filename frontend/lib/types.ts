export type {
  Holding,
  Portfolio,
  PortfolioDetail,
  PortfolioSnapshot,
  PortfolioValuation,
  User,
} from './contracts';

export type CreatePortfolioPayload = {
  name: string;
};

export type UpsertHoldingPayload = {
  symbol: string;
  quantity: string;
  average_cost_basis: string;
};
