import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {getValuation, listHoldings, listSnapshots} from '@/lib/api';

function jsonResponse(payload: unknown, status = 200): Partial<Response> {
  return {
    ok: true,
    status,
    json: vi.fn().mockResolvedValue(payload),
    text: vi.fn().mockResolvedValue(''),
  };
}

function errorResponse(message: string, status = 500): Partial<Response> {
  return {
    ok: false,
    status,
    json: vi.fn(),
    text: vi.fn().mockResolvedValue(message),
  };
}

describe('frontend api client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses normalized valuation payloads', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        portfolio_id: 'portfolio-1',
        total_market_value: '300.5',
        total_cost_basis: '200',
        unrealized_pnl: '100.5',
        holdings_count: 1,
        priced_holdings_count: 1,
        as_of: '2026-03-24T12:00:00Z',
      }),
    );

    await expect(getValuation('portfolio-1')).resolves.toEqual({
      portfolio_id: 'portfolio-1',
      total_market_value: '300.5',
      total_cost_basis: '200',
      unrealized_pnl: '100.5',
      holdings_count: 1,
      priced_holdings_count: 1,
      as_of: '2026-03-24T12:00:00Z',
    });
  });

  it('rejects holdings payloads with padded decimal strings', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'holding-1',
          portfolio_id: 'portfolio-1',
          symbol: 'AAPL',
          quantity: '12.5000',
          average_cost_basis: '182.5',
          created_at: '2026-03-24T12:00:00Z',
          updated_at: '2026-03-24T12:00:00Z',
        },
      ]),
    );

    await expect(listHoldings('portfolio-1')).rejects.toThrow(
      'holding.quantity must be a normalized decimal string.',
    );
  });

  it('rejects malformed snapshot payload shapes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({items: []}));

    await expect(listSnapshots('portfolio-1')).rejects.toThrow(
      'snapshots must be an array.',
    );
  });

  it('surfaces server error messages for failed requests', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse('Portfolio valuation unavailable.', 503),
    );

    await expect(getValuation('portfolio-1')).rejects.toThrow(
      'Portfolio valuation unavailable.',
    );
  });
});
