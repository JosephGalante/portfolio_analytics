from __future__ import annotations

from app.core.constants import portfolio_valuation_key, symbol_last_price_key
from httpx import AsyncClient


async def create_portfolio(client: AsyncClient, name: str = "Growth") -> dict:
    response = await client.post("/portfolios", json={"name": name})
    assert response.status_code == 201
    return response.json()


async def test_create_and_list_portfolios(client: AsyncClient) -> None:
    created = await create_portfolio(client, "Long-term Growth")

    response = await client.get("/portfolios")

    assert response.status_code == 200
    portfolios = response.json()
    assert len(portfolios) == 1
    assert portfolios[0]["id"] == created["id"]
    assert portfolios[0]["name"] == "Long-term Growth"


async def test_holdings_upsert_keeps_single_symbol_row(client: AsyncClient) -> None:
    portfolio = await create_portfolio(client)

    first_response = await client.post(
        f"/portfolios/{portfolio['id']}/holdings",
        json={
            "symbol": "aapl",
            "quantity": "10",
            "average_cost_basis": "180.00",
        },
    )
    assert first_response.status_code == 201

    second_response = await client.post(
        f"/portfolios/{portfolio['id']}/holdings",
        json={
            "symbol": "AAPL",
            "quantity": "12.5",
            "average_cost_basis": "182.50",
        },
    )
    assert second_response.status_code == 201

    holdings_response = await client.get(f"/portfolios/{portfolio['id']}/holdings")
    assert holdings_response.status_code == 200
    holdings = holdings_response.json()

    assert len(holdings) == 1
    assert holdings[0]["symbol"] == "AAPL"
    assert holdings[0]["quantity"] == "12.5"
    assert holdings[0]["average_cost_basis"] == "182.5"


async def test_valuation_cold_cache_falls_back_and_warms_redis(
    client: AsyncClient,
    fake_redis,
) -> None:
    portfolio = await create_portfolio(client)
    portfolio_id = portfolio["id"]

    holding_response = await client.post(
        f"/portfolios/{portfolio_id}/holdings",
        json={
            "symbol": "MSFT",
            "quantity": "2",
            "average_cost_basis": "100.00",
        },
    )
    assert holding_response.status_code == 201

    await fake_redis.set(symbol_last_price_key("MSFT"), "150.2500")

    valuation_response = await client.get(f"/portfolios/{portfolio_id}/valuation")
    assert valuation_response.status_code == 200
    payload = valuation_response.json()

    assert payload["portfolio_id"] == portfolio_id
    assert payload["total_market_value"] == "300.5"
    assert payload["total_cost_basis"] == "200"
    assert payload["unrealized_pnl"] == "100.5"
    assert payload["holdings_count"] == 1
    assert payload["priced_holdings_count"] == 1

    cached_value = await fake_redis.get(portfolio_valuation_key(portfolio_id))
    assert cached_value is not None
