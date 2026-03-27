from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.user import User
from app.services import stytch_service

_HASH_NAME = "sha256"
_ITERATIONS = 600_000
_SALT_BYTES = 16
_GUEST_TOKEN_ISSUER = "portfolio-analytics"
_GUEST_TOKEN_PREFIX = "guest_"


@dataclass(slots=True)
class GuestSession:
    expires_at: datetime
    token: str


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def issue_guest_session(user: User) -> GuestSession:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.guest_demo_session_ttl_minutes)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "exp": int(expires_at.timestamp()),
        "iss": _GUEST_TOKEN_ISSUER,
        "sub": str(user.id),
        "type": "guest_demo",
    }
    signing_input = ".".join(
        [
            _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(
        settings.guest_demo_token_secret.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return GuestSession(
        expires_at=expires_at,
        token=f"{_GUEST_TOKEN_PREFIX}{signing_input}.{_b64url_encode(signature)}",
    )


async def authenticate_bearer_token(
    session: AsyncSession,
    *,
    token: str,
) -> User | None:
    if token.startswith(_GUEST_TOKEN_PREFIX):
        return await authenticate_guest_session(
            session,
            guest_session_token=token.removeprefix(_GUEST_TOKEN_PREFIX),
        )
    return await authenticate_stytch_session(session, session_jwt=token)


async def authenticate_guest_session(
    session: AsyncSession,
    *,
    guest_session_token: str,
) -> User | None:
    settings = get_settings()
    if not settings.is_guest_demo_enabled:
        return None

    try:
        encoded_header, encoded_payload, encoded_signature = guest_session_token.split(".")
    except ValueError:
        return None

    signing_input = f"{encoded_header}.{encoded_payload}"
    expected_signature = hmac.new(
        settings.guest_demo_token_secret.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    try:
        actual_signature = _b64url_decode(encoded_signature)
    except (ValueError, TypeError):
        return None

    if not hmac.compare_digest(actual_signature, expected_signature):
        return None

    try:
        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None

    if not isinstance(payload, dict):
        return None
    if payload.get("iss") != _GUEST_TOKEN_ISSUER or payload.get("type") != "guest_demo":
        return None

    raw_exp = payload.get("exp")
    raw_sub = payload.get("sub")
    if not isinstance(raw_exp, int) or raw_exp <= int(datetime.now(UTC).timestamp()):
        return None
    if not isinstance(raw_sub, str):
        return None

    try:
        user_id = UUID(raw_sub)
    except ValueError:
        return None

    result = await session.execute(select(User).where(User.id == user_id, User.is_demo.is_(True)))
    return result.scalar_one_or_none()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    derived_key = hashlib.pbkdf2_hmac(
        _HASH_NAME,
        password.encode("utf-8"),
        salt,
        _ITERATIONS,
    )
    return f"pbkdf2_{_HASH_NAME}${_ITERATIONS}${salt.hex()}${derived_key.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, derived_key_hex = password_hash.split("$", maxsplit=3)
    except ValueError:
        return False

    if algorithm != f"pbkdf2_{_HASH_NAME}":
        return False

    try:
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(derived_key_hex)
        rounds = int(iterations)
    except ValueError:
        return False

    actual = hashlib.pbkdf2_hmac(
        _HASH_NAME,
        password.encode("utf-8"),
        salt,
        rounds,
    )
    return hmac.compare_digest(actual, expected)


async def authenticate_stytch_session(
    session: AsyncSession,
    *,
    session_jwt: str,
) -> User | None:
    identity = await stytch_service.authenticate_session_jwt(session_jwt)
    if identity is None:
        return None

    existing_by_stytch = await session.execute(
        select(User).where(User.stytch_user_id == identity.user_id)
    )
    user = existing_by_stytch.scalar_one_or_none()

    if user is None:
        existing_by_email = await session.execute(select(User).where(User.email == identity.email))
        user = existing_by_email.scalar_one_or_none()

        if user is not None and user.stytch_user_id not in (None, identity.user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That email is already linked to another Stytch account.",
            )

    user_was_created = False
    user_was_updated = False

    if user is None:
        user = User(
            email=identity.email,
            name=identity.name,
            password_hash=None,
            stytch_user_id=identity.user_id,
        )
        session.add(user)
        user_was_created = True
    else:
        if user.stytch_user_id != identity.user_id:
            user.stytch_user_id = identity.user_id
            user_was_updated = True

        if user.email != identity.email:
            conflicting_user = await session.execute(
                select(User).where(User.email == identity.email, User.id != user.id)
            )
            if conflicting_user.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="That Stytch email is already linked to another account.",
                )
            user.email = identity.email
            user_was_updated = True

        if user.name != identity.name and identity.name:
            user.name = identity.name
            user_was_updated = True

    if user_was_created or user_was_updated:
        await session.commit()
        await session.refresh(user)

    return user
