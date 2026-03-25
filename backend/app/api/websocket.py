from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.api.deps import get_current_user_from_websocket
from app.db.session import AsyncSessionLocal
from app.services import portfolio_service
from app.websocket.manager import connection_manager

router = APIRouter()


@router.websocket("/ws/portfolios/{portfolio_id}")
async def portfolio_websocket(websocket: WebSocket, portfolio_id: UUID) -> None:
    async with AsyncSessionLocal() as session:
        current_user = await get_current_user_from_websocket(websocket, session)
        if current_user is None:
            return

        try:
            await portfolio_service.get_portfolio_for_user(session, portfolio_id, current_user.id)
        except Exception:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Portfolio not found.",
            )
            return

    await connection_manager.connect(portfolio_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(portfolio_id, websocket)
