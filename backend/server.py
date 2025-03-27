import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import uvicorn

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, room: str, username: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = {}
        self.active_connections[room][username] = websocket

    async def disconnect(self, room: str, username: str):
        if room in self.active_connections and username in self.active_connections[room]:
            del self.active_connections[room][username]

    async def broadcast(self, room: str, message: str):
        if room in self.active_connections:
            for connection in self.active_connections[room].values():
                await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/{username}/{room}")
async def websocket_endpoint(websocket: WebSocket, username: str, room: str):
    await manager.connect(websocket, room, username)
    try:
        await manager.broadcast(room, f"🚀 {username} entrou na sala!")
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(room, f"{username}: {data}")
    except WebSocketDisconnect:
        await manager.disconnect(room, username)
        await manager.broadcast(room, f"👋 {username} saiu da sala")

@app.get("/")
async def health_check():
    return {"status": "ok", "websocket": "wss://your-url/ws/{username}/{room}"}

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=True,
        ws_ping_interval=20,
        ws_ping_timeout=20
    )
