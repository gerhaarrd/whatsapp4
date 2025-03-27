import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

# Configuração CORS mínima necessária
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, room: str, username: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = {}
        self.active_connections[room][username] = websocket
        await self.broadcast(room, f"🚀 {username} entrou na sala!")

    async def disconnect(self, room: str, username: str):
        if room in self.active_connections and username in self.active_connections[room]:
            del self.active_connections[room][username]
            await self.broadcast(room, f"👋 {username} saiu da sala")

    async def broadcast(self, room: str, message: str):
        if room in self.active_connections:
            for username, connection in self.active_connections[room].items():
                try:
                    await connection.send_text(message)
                except:
                    await self.disconnect(room, username)

manager = ConnectionManager()

@app.websocket("/ws/{username}/{room}")
async def websocket_endpoint(websocket: WebSocket, username: str, room: str):
    await manager.connect(websocket, room, username)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(room, f"{username}: {data}")
    except WebSocketDisconnect:
        await manager.disconnect(room, username)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
