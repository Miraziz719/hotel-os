"""
WebSocket connection manager.
Keeps a list of connected dashboard clients and broadcasts updates to all of them.
"""
import json
from typing import List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # List of active WebSocket connections
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Send a JSON message to every connected dashboard client."""
        text = json.dumps(message)
        dead = []
        for connection in self.active_connections:
            try:
                await connection.send_text(text)
            except Exception:
                # Connection is broken; remove it after iteration
                dead.append(connection)
        for conn in dead:
            self.disconnect(conn)


# Singleton used across the app
manager = ConnectionManager()

