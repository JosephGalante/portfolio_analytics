import {z} from 'zod';

const NORMALIZED_DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/;

const normalizedDecimalStringSchema = z
  .string()
  .refine((value) => value !== '-0' && NORMALIZED_DECIMAL_PATTERN.test(value), {
    message: 'must be a normalized decimal string.',
  });

export const portfolioSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});

export const portfolioDetailSchema = portfolioSchema.extend({
  holdings_count: z.number(),
});

export const holdingSchema = z.object({
  id: z.string(),
  portfolio_id: z.string(),
  symbol: z.string(),
  quantity: normalizedDecimalStringSchema,
  average_cost_basis: normalizedDecimalStringSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const portfolioValuationSchema = z.object({
  portfolio_id: z.string(),
  total_market_value: normalizedDecimalStringSchema,
  total_cost_basis: normalizedDecimalStringSchema,
  unrealized_pnl: normalizedDecimalStringSchema,
  holdings_count: z.number(),
  priced_holdings_count: z.number(),
  as_of: z.string(),
});

export const portfolioSnapshotSchema = z.object({
  id: z.string(),
  portfolio_id: z.string(),
  total_market_value: normalizedDecimalStringSchema,
  total_cost_basis: normalizedDecimalStringSchema,
  unrealized_pnl: normalizedDecimalStringSchema,
  captured_at: z.string(),
});

export type Portfolio = z.infer<typeof portfolioSchema>;
export type User = z.infer<typeof userSchema>;
export type PortfolioDetail = z.infer<typeof portfolioDetailSchema>;
export type Holding = z.infer<typeof holdingSchema>;
export type PortfolioValuation = z.infer<typeof portfolioValuationSchema>;
export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>;

function formatContractError(error: z.ZodError, context: string): string {
  const issue = error.issues[0];
  if (!issue) {
    return `${context} is invalid.`;
  }

  if (issue.path.length === 0) {
    if (issue.code === 'invalid_type' && issue.expected === 'array') {
      return `${context} must be an array.`;
    }

    if (issue.code === 'invalid_type' && issue.expected === 'object') {
      return `${context} must be an object.`;
    }

    return `${context} ${issue.message}`;
  }

  const path = issue.path.join('.');

  if (issue.code === 'invalid_type') {
    if (issue.expected === 'string') {
      return `${context}.${path} must be a string.`;
    }

    if (issue.expected === 'number') {
      return `${context}.${path} must be a number.`;
    }
  }

  return `${context}.${path} ${issue.message}`;
}

function parsePayload<T>(
  schema: z.ZodType<T>,
  payload: unknown,
  context: string,
): T {
  const result = schema.safeParse(payload);

  if (result.success) {
    return result.data;
  }

  throw new Error(formatContractError(result.error, context));
}

function parsePayloadList<T>(
  payload: unknown,
  context: string,
  itemParser: (item: unknown) => T,
): T[] {
  const result = z.array(z.unknown()).safeParse(payload);

  if (!result.success) {
    throw new Error(`${context} must be an array.`);
  }

  return result.data.map(itemParser);
}

export function parsePortfolioPayload(payload: unknown): Portfolio {
  return parsePayload(portfolioSchema, payload, 'portfolio');
}

export function parseUserPayload(payload: unknown): User {
  return parsePayload(userSchema, payload, 'user');
}

export function parsePortfoliosPayload(payload: unknown): Portfolio[] {
  return parsePayloadList(payload, 'portfolios', parsePortfolioPayload);
}

export function parsePortfolioDetailPayload(payload: unknown): PortfolioDetail {
  return parsePayload(portfolioDetailSchema, payload, 'portfolio');
}

export function parseHoldingPayload(payload: unknown): Holding {
  return parsePayload(holdingSchema, payload, 'holding');
}

export function parseHoldingsPayload(payload: unknown): Holding[] {
  return parsePayloadList(payload, 'holdings', parseHoldingPayload);
}

export function parsePortfolioValuationPayload(
  payload: unknown,
): PortfolioValuation {
  return parsePayload(portfolioValuationSchema, payload, 'valuation');
}

export function parsePortfolioSnapshotPayload(
  payload: unknown,
): PortfolioSnapshot {
  return parsePayload(portfolioSnapshotSchema, payload, 'snapshot');
}

export function parsePortfolioSnapshotsPayload(
  payload: unknown,
): PortfolioSnapshot[] {
  return parsePayloadList(payload, 'snapshots', parsePortfolioSnapshotPayload);
}
