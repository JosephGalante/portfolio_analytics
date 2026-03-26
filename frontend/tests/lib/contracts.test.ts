import {describe, expect, it} from 'vitest';

import {
  parseHoldingPayload,
  parsePortfolioSnapshotsPayload,
  parsePortfolioValuationPayload,
} from '@/lib/contracts';

describe('frontend payload contracts', () => {
  it('accepts normalized decimal strings for valuations', () => {
    expect(
      parsePortfolioValuationPayload({
        portfolio_id: 'portfolio-1',
        total_market_value: '300.5',
        total_cost_basis: '200',
        unrealized_pnl: '-10.25',
        holdings_count: 1,
        priced_holdings_count: 1,
        as_of: '2026-03-24T12:00:00Z',
      }),
    ).toEqual({
      portfolio_id: 'portfolio-1',
      total_market_value: '300.5',
      total_cost_basis: '200',
      unrealized_pnl: '-10.25',
      holdings_count: 1,
      priced_holdings_count: 1,
      as_of: '2026-03-24T12:00:00Z',
    });
  });

  it('rejects non-normalized decimal strings for holdings', () => {
    expect(() =>
      parseHoldingPayload({
        id: 'holding-1',
        portfolio_id: 'portfolio-1',
        symbol: 'AAPL',
        quantity: '12.5000',
        average_cost_basis: '182.5',
        created_at: '2026-03-24T12:00:00Z',
        updated_at: '2026-03-24T12:00:00Z',
      }),
    ).toThrow(/holding\.quantity must be a normalized decimal string\./);
  });

  it('validates each snapshot in a snapshot payload list', () => {
    expect(() =>
      parsePortfolioSnapshotsPayload([
        {
          id: 'snapshot-1',
          portfolio_id: 'portfolio-1',
          total_market_value: '300.5',
          total_cost_basis: '200',
          unrealized_pnl: '100.5',
          captured_at: '2026-03-24T12:00:00Z',
        },
        {
          id: 'snapshot-2',
          portfolio_id: 'portfolio-1',
          total_market_value: '300.5000',
          total_cost_basis: '200',
          unrealized_pnl: '100.5',
          captured_at: '2026-03-24T12:05:00Z',
        },
      ]),
    ).toThrow(
      /snapshot\.total_market_value must be a normalized decimal string\./,
    );
  });
});
