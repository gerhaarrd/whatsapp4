import os
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict

app = FastAPI()

connections: Dict[str, WebSocket] = {}

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await websocket.accept()
    connections[username] = websocket

    try:
        await send_online_users()

        while True:
            data = await websocket.receive_text()
            parts = data.split(":", 1)

            if len(parts) == 2:
                target_user, message = parts
                if target_user in connections:
                    await connections[target_user].send_text(f"{username} (privado): {message}")
                else:
                    await websocket.send_text(f"⚠️ Usuário {target_user} não encontrado.")
            else:
                await broadcast_message(f"{username}: {data}")

    except WebSocketDisconnect:
        del connections[username]
        await send_online_users()

async def broadcast_message(message: str):
    for user, websocket in connections.items():
        await websocket.send_text(message)

async def send_online_users():
    online_users = ", ".join(connections.keys())
    for user, websocket in connections.items():
        await websocket.send_text(f"👥 Usuários online: {online_users}")

# Obtém a porta do ambiente ou usa a padrão 8000
PORT = int(os.getenv("PORT", 8000))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
