import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import uvicorn
import logging

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Armazenamento de conexões ativas
rooms: Dict[str, Set[WebSocket]] = {}

@app.websocket("/ws/{username}/{room}")
async def websocket_endpoint(websocket: WebSocket, username: str, room: str):
    try:
        await websocket.accept()
        
        # Validar nome de usuário único
        existing_users = [ws.url.path.split("/")[-2] for ws in rooms.get(room, set())]
        if username in existing_users:
            error_msg = f"🚨 Erro: O nome '{username}' já está em uso na sala '{room}'"
            await websocket.send_text(error_msg)
            await websocket.close(code=1008, reason=error_msg)
            return

        # Registrar conexão
        if room not in rooms:
            rooms[room] = set()
        rooms[room].add(websocket)
        logger.info(f"{username} entrou na sala {room}")

        try:
            await send_online_users(room)
            await broadcast_message(f"🚀 {username} entrou na sala!", room)

            while True:
                try:
                    data = await websocket.receive_text()
                    
                    # Lidar com mensagens privadas
                    if data.startswith("privado:"):
                        await handle_private_message(data, username, room)
                    # Lidar com mensagens normais
                    else:
                        await broadcast_message(f"{username}: {data}", room)

                except WebSocketDisconnect:
                    raise
                except Exception as e:
                    logger.error(f"Erro no processamento da mensagem: {str(e)}")
                    await websocket.send_text("⚠️ Erro ao processar mensagem")

        except WebSocketDisconnect:
            await handle_disconnect(username, room)
            
    except Exception as e:
        logger.error(f"Erro no WebSocket: {str(e)}")
        try:
            await websocket.close(code=1011, reason="Erro interno")
        except:
            pass

async def handle_private_message(data: str, sender: str, room: str):
    """Lidar com mensagens privadas"""
    try:
        _, target_user, message = data.split(":", 2)
        await send_private_message(sender, target_user, message, room)
    except ValueError:
        logger.warning("Formato de mensagem privada inválido")
        raise

async def handle_disconnect(username: str, room: str):
    """Limpar após desconexão"""
    if room in rooms and username in [ws.url.path.split("/")[-2] for ws in rooms[room]]:
        rooms[room] = {ws for ws in rooms[room] if ws.url.path.split("/")[-2] != username}
        logger.info(f"{username} saiu da sala {room}")
        await broadcast_message(f"👋 {username} saiu da sala.", room)
        await send_online_users(room)

# Funções auxiliares
async def broadcast_message(message: str, room: str):
    """Transmitir mensagem para todos na sala"""
    if room not in rooms:
        return

    dead_connections = []
    for ws in rooms[room]:
        try:
            await ws.send_text(message)
        except Exception as e:
            logger.warning(f"Falha ao enviar para {ws}: {str(e)}")
            dead_connections.append(ws)
    
    # Limpar conexões mortas
    for ws in dead_connections:
        rooms[room].remove(ws)

async def send_private_message(sender: str, target: str, message: str, room: str):
    """Enviar mensagem privada"""
    if room not in rooms:
        return

    for ws in list(rooms[room]):
        try:
            path_parts = ws.url.path.split("/")
            if len(path_parts) >= 3 and path_parts[-2] == target:
                await ws.send_text(f"🔒 {sender} (privado): {message}")
        except:
            rooms[room].remove(ws)

async def send_online_users(room: str):
    """Enviar lista atualizada de usuários para a sala"""
    if room in rooms:
        users = [ws.url.path.split("/")[-2] for ws in list(rooms[room])]
        await broadcast_message(f"👥 Online ({room}): {', '.join(users)}", room)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))