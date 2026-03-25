from __future__ import annotations

from httpx import AsyncClient


async def register_user(
    client: AsyncClient,
    *,
    email: str,
    name: str,
    password: str,
) -> dict:
    response = await client.post(
        "/auth/register",
        json={
            "email": email,
            "name": name,
            "password": password,
        },
    )
    assert response.status_code == 201
    return response.json()


async def test_register_and_fetch_current_user(
    unauthenticated_client: AsyncClient,
    basic_auth_header,
) -> None:
    user = await register_user(
        unauthenticated_client,
        email="owner@example.com",
        name="Owner One",
        password="password123",
    )

    response = await unauthenticated_client.get(
        "/auth/me",
        headers=basic_auth_header("owner@example.com", "password123"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == user["id"]
    assert payload["email"] == "owner@example.com"
    assert payload["name"] == "Owner One"


async def test_portfolios_are_scoped_to_authenticated_user(
    unauthenticated_client: AsyncClient,
    basic_auth_header,
) -> None:
    await register_user(
        unauthenticated_client,
        email="alpha@example.com",
        name="Alpha",
        password="password123",
    )
    await register_user(
        unauthenticated_client,
        email="beta@example.com",
        name="Beta",
        password="password123",
    )

    create_response = await unauthenticated_client.post(
        "/portfolios",
        json={"name": "Alpha Portfolio"},
        headers=basic_auth_header("alpha@example.com", "password123"),
    )
    assert create_response.status_code == 201
    portfolio_id = create_response.json()["id"]

    beta_list_response = await unauthenticated_client.get(
        "/portfolios",
        headers=basic_auth_header("beta@example.com", "password123"),
    )
    assert beta_list_response.status_code == 200
    assert beta_list_response.json() == []

    beta_detail_response = await unauthenticated_client.get(
        f"/portfolios/{portfolio_id}",
        headers=basic_auth_header("beta@example.com", "password123"),
    )
    assert beta_detail_response.status_code == 404
