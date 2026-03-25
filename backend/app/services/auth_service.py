from __future__ import annotations

import hashlib
import hmac
import secrets

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

_HASH_NAME = "sha256"
_ITERATIONS = 600_000
_SALT_BYTES = 16


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


async def register_user(
    session: AsyncSession,
    *,
    email: str,
    name: str,
    password: str,
) -> User:
    existing = await session.execute(select(User).where(User.email == email.lower()))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with that email already exists.",
        )

    user = User(
        email=email.lower(),
        name=name.strip(),
        password_hash=hash_password(password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def authenticate_user(
    session: AsyncSession,
    *,
    email: str,
    password: str,
) -> User | None:
    result = await session.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    if user is None or user.password_hash is None:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user
