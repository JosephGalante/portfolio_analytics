from __future__ import annotations

import hashlib
import hmac
import secrets

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services import stytch_service

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
