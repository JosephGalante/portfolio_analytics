from __future__ import annotations

from app.api import health as health_api
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


async def test_health_returns_liveness_metadata(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_ready_returns_dependency_and_config_status(
    client: AsyncClient,
    monkeypatch,
) -> None:
    monkeypatch.setattr(health_api.settings, "stytch_project_id", "project-test")
    monkeypatch.setattr(health_api.settings, "stytch_secret", "secret-test")
    monkeypatch.setattr(health_api.settings, "finnhub_api_key", "finnhub-test")
    monkeypatch.setattr(health_api.settings, "run_embedded_workers", True)

    response = await client.get("/ready")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["checks"]["database"] == "ok"
    assert payload["checks"]["redis"] == "ok"
    assert payload["checks"]["stytch"] == "configured"
    assert payload["checks"]["market_data"] == "configured"
    assert payload["checks"]["embedded_workers"] == "enabled"


async def test_ready_allows_guest_demo_without_stytch(
    client: AsyncClient,
    monkeypatch,
) -> None:
    monkeypatch.setattr(health_api.settings, "guest_demo_mode", True)
    monkeypatch.setattr(health_api.settings, "guest_demo_token_secret", "guest-demo-secret")
    monkeypatch.setattr(health_api.settings, "stytch_project_id", "")
    monkeypatch.setattr(health_api.settings, "stytch_secret", "")
    monkeypatch.setattr(health_api.settings, "finnhub_api_key", "finnhub-test")
    monkeypatch.setattr(health_api.settings, "run_embedded_workers", True)

    response = await client.get("/ready")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["checks"]["guest_demo"] == "enabled"
    assert payload["checks"]["stytch"] == "optional"


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


async def test_valuation_fetches_market_data_when_symbol_cache_is_empty(
    client: AsyncClient,
    fake_redis,
) -> None:
    portfolio = await create_portfolio(client)
    portfolio_id = portfolio["id"]

    holding_response = await client.post(
        f"/portfolios/{portfolio_id}/holdings",
        json={
            "symbol": "AAPL",
            "quantity": "2",
            "average_cost_basis": "100.00",
        },
    )
    assert holding_response.status_code == 201

    valuation_response = await client.get(f"/portfolios/{portfolio_id}/valuation")
    assert valuation_response.status_code == 200
    payload = valuation_response.json()

    assert payload["total_market_value"] == "370"
    assert payload["total_cost_basis"] == "200"
    assert payload["unrealized_pnl"] == "170"
    assert payload["priced_holdings_count"] == 1

    assert await fake_redis.get(symbol_last_price_key("AAPL")) == "185.0000"
