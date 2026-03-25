import base64
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models.user import User
from app.services import auth_service

basic_auth_scheme = HTTPBasic(auto_error=False)


@dataclass(slots=True)
class BasicAuthData:
    username: str
    password: str


async def get_db(session: AsyncSession = Depends(get_db_session)) -> AsyncIterator[AsyncSession]:
    yield session


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Basic"},
    )


def _parse_basic_authorization(authorization: str | None) -> BasicAuthData | None:
    if authorization is None or not authorization.startswith("Basic "):
        return None

    try:
        decoded = base64.b64decode(authorization[6:]).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None

    if ":" not in decoded:
        return None

    username, password = decoded.split(":", maxsplit=1)
    return BasicAuthData(username=username, password=password)


async def get_current_user(
    session: AsyncSession = Depends(get_db),
    credentials: Annotated[HTTPBasicCredentials | None, Depends(basic_auth_scheme)] = None,
) -> User:
    if credentials is None:
        raise _unauthorized("Not authenticated.")

    user = await auth_service.authenticate_user(
        session,
        email=credentials.username,
        password=credentials.password,
    )
    if user is None:
        raise _unauthorized("Invalid email or password.")
    return user


async def get_current_user_from_websocket(
    websocket: WebSocket,
    session: AsyncSession,
) -> User | None:
    credentials = _parse_basic_authorization(websocket.query_params.get("authorization"))
    if credentials is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Not authenticated.")
        return None

    user = await auth_service.authenticate_user(
        session,
        email=credentials.username,
        password=credentials.password,
    )
    if user is None:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Invalid email or password.",
        )
        return None
    return user
