const NORMALIZED_DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/;

type HoldingPayload = {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: string;
  average_cost_basis: string;
  created_at: string;
  updated_at: string;
};

type PortfolioValuationPayload = {
  portfolio_id: string;
  total_market_value: string;
  total_cost_basis: string;
  unrealized_pnl: string;
  holdings_count: number;
  priced_holdings_count: number;
  as_of: string;
};

type PortfolioSnapshotPayload = {
  id: string;
  portfolio_id: string;
  total_market_value: string;
  total_cost_basis: string;
  unrealized_pnl: string;
  captured_at: string;
};

function assertRecord(
  value: unknown,
  context: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
}

function readString(
  value: Record<string, unknown>,
  field: string,
  context: string,
): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== "string") {
    throw new Error(`${context}.${field} must be a string.`);
  }
  return fieldValue;
}

function readNumber(
  value: Record<string, unknown>,
  field: string,
  context: string,
): number {
  const fieldValue = value[field];
  if (typeof fieldValue !== "number") {
    throw new Error(`${context}.${field} must be a number.`);
  }
  return fieldValue;
}

function readNormalizedDecimalString(
  value: Record<string, unknown>,
  field: string,
  context: string,
): string {
  const fieldValue = readString(value, field, context);
  if (
    fieldValue === "-0" ||
    !NORMALIZED_DECIMAL_PATTERN.test(fieldValue)
  ) {
    throw new Error(
      `${context}.${field} must be a normalized decimal string.`,
    );
  }
  return fieldValue;
}

export function parseHoldingPayload(payload: unknown): HoldingPayload {
  assertRecord(payload, "holding");
  return {
    id: readString(payload, "id", "holding"),
    portfolio_id: readString(payload, "portfolio_id", "holding"),
    symbol: readString(payload, "symbol", "holding"),
    quantity: readNormalizedDecimalString(payload, "quantity", "holding"),
    average_cost_basis: readNormalizedDecimalString(
      payload,
      "average_cost_basis",
      "holding",
    ),
    created_at: readString(payload, "created_at", "holding"),
    updated_at: readString(payload, "updated_at", "holding"),
  };
}

export function parseHoldingsPayload(payload: unknown): HoldingPayload[] {
  if (!Array.isArray(payload)) {
    throw new Error("holdings must be an array.");
  }
  return payload.map((holding) => parseHoldingPayload(holding));
}

export function parsePortfolioValuationPayload(
  payload: unknown,
): PortfolioValuationPayload {
  assertRecord(payload, "valuation");
  return {
    portfolio_id: readString(payload, "portfolio_id", "valuation"),
    total_market_value: readNormalizedDecimalString(
      payload,
      "total_market_value",
      "valuation",
    ),
    total_cost_basis: readNormalizedDecimalString(
      payload,
      "total_cost_basis",
      "valuation",
    ),
    unrealized_pnl: readNormalizedDecimalString(
      payload,
      "unrealized_pnl",
      "valuation",
    ),
    holdings_count: readNumber(payload, "holdings_count", "valuation"),
    priced_holdings_count: readNumber(
      payload,
      "priced_holdings_count",
      "valuation",
    ),
    as_of: readString(payload, "as_of", "valuation"),
  };
}

export function parsePortfolioSnapshotPayload(
  payload: unknown,
): PortfolioSnapshotPayload {
  assertRecord(payload, "snapshot");
  return {
    id: readString(payload, "id", "snapshot"),
    portfolio_id: readString(payload, "portfolio_id", "snapshot"),
    total_market_value: readNormalizedDecimalString(
      payload,
      "total_market_value",
      "snapshot",
    ),
    total_cost_basis: readNormalizedDecimalString(
      payload,
      "total_cost_basis",
      "snapshot",
    ),
    unrealized_pnl: readNormalizedDecimalString(
      payload,
      "unrealized_pnl",
      "snapshot",
    ),
    captured_at: readString(payload, "captured_at", "snapshot"),
  };
}

export function parsePortfolioSnapshotsPayload(
  payload: unknown,
): PortfolioSnapshotPayload[] {
  if (!Array.isArray(payload)) {
    throw new Error("snapshots must be an array.");
  }
  return payload.map((snapshot) => parsePortfolioSnapshotPayload(snapshot));
}
