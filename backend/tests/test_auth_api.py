from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.models.user import User
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


async def create_user(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    email: str,
    is_demo: bool = False,
    name: str,
    stytch_user_id: str,
) -> User:
    async with session_factory() as session:
        user = User(
            email=email,
            name=name,
            password_hash=None,
            stytch_user_id=stytch_user_id,
            is_demo=is_demo,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def test_fetch_current_user_with_stytch_bearer_auth(
    unauthenticated_client: AsyncClient,
    bearer_auth_header,
    monkeypatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    user = await create_user(
        session_factory,
        email="stytch@example.com",
        name="Stytch User",
        stytch_user_id="user-test-1",
    )

    async def authenticate_stytch_session(*_: Any, session_jwt: str) -> User | None:
        if session_jwt != "valid-session-jwt":
            return None
        return user

    monkeypatch.setattr(
        "app.services.auth_service.authenticate_stytch_session",
        authenticate_stytch_session,
    )

    response = await unauthenticated_client.get(
        "/auth/me",
        headers=bearer_auth_header("valid-session-jwt"),
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(user.id),
        "email": "stytch@example.com",
        "name": "Stytch User",
        "is_demo": False,
    }


async def test_portfolios_are_scoped_with_stytch_bearer_auth(
    unauthenticated_client: AsyncClient,
    bearer_auth_header,
    monkeypatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    alpha = await create_user(
        session_factory,
        email="alpha@example.com",
        name="Alpha",
        stytch_user_id="user-alpha",
    )
    beta = await create_user(
        session_factory,
        email="beta@example.com",
        name="Beta",
        stytch_user_id="user-beta",
    )

    async def authenticate_stytch_session(*_: Any, session_jwt: str) -> User | None:
        if session_jwt == "alpha-session":
            return alpha
        if session_jwt == "beta-session":
            return beta
        return None

    monkeypatch.setattr(
        "app.services.auth_service.authenticate_stytch_session",
        authenticate_stytch_session,
    )

    create_response = await unauthenticated_client.post(
        "/portfolios",
        json={"name": "Alpha Portfolio"},
        headers=bearer_auth_header("alpha-session"),
    )
    assert create_response.status_code == 201
    portfolio_id = create_response.json()["id"]

    beta_list_response = await unauthenticated_client.get(
        "/portfolios",
        headers=bearer_auth_header("beta-session"),
    )
    assert beta_list_response.status_code == 200
    assert beta_list_response.json() == []

    beta_detail_response = await unauthenticated_client.get(
        f"/portfolios/{portfolio_id}",
        headers=bearer_auth_header("beta-session"),
    )
    assert beta_detail_response.status_code == 404


async def test_create_guest_session_and_fetch_current_user(
    unauthenticated_client: AsyncClient,
    bearer_auth_header,
    monkeypatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "guest_demo_mode", True)
    monkeypatch.setattr(settings, "guest_demo_token_secret", "guest-demo-test-secret")

    session_response = await unauthenticated_client.post("/auth/guest-session")

    assert session_response.status_code == 201
    session_payload = session_response.json()
    assert session_payload["token_type"] == "bearer"
    assert session_payload["access_token"].startswith("guest_")
    assert session_payload["user"]["is_demo"] is True

    me_response = await unauthenticated_client.get(
        "/auth/me",
        headers=bearer_auth_header(session_payload["access_token"]),
    )

    assert me_response.status_code == 200
    assert me_response.json()["is_demo"] is True


async def test_guest_demo_user_is_read_only(
    unauthenticated_client: AsyncClient,
    bearer_auth_header,
    monkeypatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "guest_demo_mode", True)
    monkeypatch.setattr(settings, "guest_demo_token_secret", "guest-demo-test-secret")

    session_response = await unauthenticated_client.post("/auth/guest-session")
    token = session_response.json()["access_token"]

    create_response = await unauthenticated_client.post(
        "/portfolios",
        json={"name": "Should Fail"},
        headers=bearer_auth_header(token),
    )

    assert create_response.status_code == 403
    assert create_response.json()["detail"] == "Guest demo portfolios are read-only."
