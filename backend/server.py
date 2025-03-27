import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import uvicorn
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str, username: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = {}
        self.active_connections[room][username] = websocket
        await self.send_user_list(room)
        await self.broadcast(room, f"🚀 {username} entrou na sala!", exclude=username)

    async def disconnect(self, room: str, username: str):
        if room in self.active_connections and username in self.active_connections[room]:
            del self.active_connections[room][username]
            await self.send_user_list(room)
            await self.broadcast(room, f"👋 {username} saiu da sala", exclude=username)

    async def send_user_list(self, room: str):
        if room in self.active_connections:
            users = list(self.active_connections[room].keys())
            await self.broadcast(room, f"👥 Online: {', '.join(users)}")

    async def broadcast(self, room: str, message: str, exclude: str = None):
        if room in self.active_connections:
            for username, connection in self.active_connections[room].items():
                try:
                    await connection.send_text(message)  # Removida a condição de exclusão
                except:
                    await self.disconnect(room, username)

    async def send_private(self, sender: str, target: str, message: str, room: str):
        if room in self.active_connections:
            # Mensagem para o destinatário
            if target in self.active_connections[room]:
                try:
                    await self.active_connections[room][target].send_text(f"🔒 {sender} (privado): {message}")
                except:
                    await self.disconnect(room, target)
            
            # Confirmação para o remetente
            if sender in self.active_connections[room]:
                try:
                    await self.active_connections[room][sender].send_text(f"🔒 Para {target}: {message}")
                except:
                    await self.disconnect(room, sender)

manager = ConnectionManager()

@app.websocket("/ws/{username}/{room}")
async def websocket_endpoint(websocket: WebSocket, username: str, room: str):
    await manager.connect(websocket, room, username)
    try:
        while True:
            data = await websocket.receive_text()
            if data.startswith("privado:"):
                _, target, msg = data.split(":", 2)
                await manager.send_private(username, target, msg, room)
            else:
                await manager.broadcast(room, f"{username}: {data}")  # Removido o exclude
    except WebSocketDisconnect:
        await manager.disconnect(room, username)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
