from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models.user import User
from app.services import auth_service

bearer_auth_scheme = HTTPBearer(auto_error=False)


@dataclass(slots=True)
class BearerAuthData:
    token: str


async def get_db(session: AsyncSession = Depends(get_db_session)) -> AsyncIterator[AsyncSession]:
    yield session


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _parse_bearer_authorization(authorization: str | None) -> BearerAuthData | None:
    if authorization is None or not authorization.startswith("Bearer "):
        return None

    token = authorization[7:].strip()
    if not token:
        return None
    return BearerAuthData(token=token)


async def get_current_user(
    session: AsyncSession = Depends(get_db),
    bearer_credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_auth_scheme)
    ] = None,
) -> User:
    if bearer_credentials is None:
        raise _unauthorized("Not authenticated.")

    user = await auth_service.authenticate_stytch_session(
        session,
        session_jwt=bearer_credentials.credentials,
    )
    if user is None:
        raise _unauthorized("Invalid session.")
    return user


async def get_current_user_from_websocket(
    websocket: WebSocket,
    session: AsyncSession,
) -> User | None:
    authorization = websocket.query_params.get("authorization")
    bearer_credentials = _parse_bearer_authorization(authorization)
    if bearer_credentials is not None:
        user = await auth_service.authenticate_stytch_session(
            session,
            session_jwt=bearer_credentials.token,
        )
        if user is None:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Invalid session.",
            )
            return None
        return user

    if bearer_credentials is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Not authenticated.")
        return None

    return None
