from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[UUID, set[WebSocket]] = defaultdict(set)

    async def connect(self, portfolio_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[portfolio_id].add(websocket)

    def disconnect(self, portfolio_id: UUID, websocket: WebSocket) -> None:
        connections = self._connections.get(portfolio_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(portfolio_id, None)

    async def broadcast_json(self, portfolio_id: UUID, payload: str) -> None:
        connections = list(self._connections.get(portfolio_id, set()))
        stale_connections: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_text(payload)
            except RuntimeError:
                stale_connections.append(websocket)

        for websocket in stale_connections:
            self.disconnect(portfolio_id, websocket)


connection_manager = ConnectionManager()
