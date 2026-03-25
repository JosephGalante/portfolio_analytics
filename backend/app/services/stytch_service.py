from __future__ import annotations

from dataclasses import dataclass

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings

_DEFAULT_TIMEOUT_SECONDS = 10.0


@dataclass(slots=True)
class StytchIdentity:
    email: str
    name: str
    user_id: str


def _normalize_name(user_payload: dict[str, object], email: str) -> str:
    name_payload = user_payload.get("name")
    if isinstance(name_payload, dict):
        first_name = str(name_payload.get("first_name") or "").strip()
        last_name = str(name_payload.get("last_name") or "").strip()
        full_name = " ".join(part for part in [first_name, last_name] if part)
        if full_name:
            return full_name

    local_part = email.split("@", maxsplit=1)[0].replace(".", " ").replace("_", " ").strip()
    if local_part:
        return " ".join(segment.capitalize() for segment in local_part.split())
    return email


def _extract_email(payload: dict[str, object]) -> str | None:
    emails = payload.get("emails")
    if isinstance(emails, list):
        for item in emails:
            if not isinstance(item, dict):
                continue
            email = item.get("email")
            if isinstance(email, str) and email.strip():
                return email.strip().lower()

    authentication_factors = payload.get("authentication_factors")
    if isinstance(authentication_factors, list):
        for factor in authentication_factors:
            if not isinstance(factor, dict):
                continue
            email_factor = factor.get("email_factor")
            if not isinstance(email_factor, dict):
                continue
            email = email_factor.get("email_address")
            if isinstance(email, str) and email.strip():
                return email.strip().lower()

    return None


def _authentication_error(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _service_error(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


async def authenticate_session_jwt(session_jwt: str) -> StytchIdentity | None:
    settings = get_settings()
    project_id = settings.stytch_project_id.strip()
    secret = settings.stytch_secret.strip()
    api_url = settings.stytch_api_url.rstrip("/")

    if not project_id or not secret:
        raise _service_error("Stytch auth is not configured.")

    try:
        async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{api_url}/sessions/authenticate",
                auth=(project_id, secret),
                json={
                    "session_jwt": session_jwt,
                },
            )
    except httpx.HTTPError as error:
        raise _service_error("Failed to reach Stytch.") from error

    if response.status_code == status.HTTP_401_UNAUTHORIZED:
        return None

    if response.status_code != status.HTTP_200_OK:
        try:
            payload = response.json()
        except ValueError:
            payload = None

        if isinstance(payload, dict):
            error_message = payload.get("error_message")
            if isinstance(error_message, str) and error_message.strip():
                raise _service_error(error_message)

        raise _service_error("Stytch session authentication failed.")

    try:
        payload = response.json()
    except ValueError as error:
        raise _service_error("Stytch returned an invalid auth response.") from error

    if not isinstance(payload, dict):
        raise _service_error("Stytch returned an invalid auth response.")

    session_payload = payload.get("session")
    user_payload = payload.get("user")
    if not isinstance(session_payload, dict) or not isinstance(user_payload, dict):
        raise _authentication_error("Stytch session is missing user details.")

    user_id = user_payload.get("user_id") or session_payload.get("user_id")
    if not isinstance(user_id, str) or not user_id.strip():
        raise _authentication_error("Stytch session is missing a user id.")

    email = _extract_email(user_payload) or _extract_email(session_payload)
    if email is None:
        raise _authentication_error("Stytch session is missing an email address.")

    return StytchIdentity(
        email=email,
        name=_normalize_name(user_payload, email),
        user_id=user_id.strip(),
    )
