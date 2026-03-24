from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.manager import connection_manager

router = APIRouter()


@router.websocket("/ws/portfolios/{portfolio_id}")
async def portfolio_websocket(websocket: WebSocket, portfolio_id: UUID) -> None:
    await connection_manager.connect(portfolio_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(portfolio_id, websocket)
