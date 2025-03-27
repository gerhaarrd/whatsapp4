import os
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from typing import Dict, Set
from PIL import Image, UnidentifiedImageError
import uvicorn
import io
import logging
from fastapi.middleware.cors import CORSMiddleware

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir todas as origens para simplificar
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Server settings
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount(f"/{UPLOAD_DIR}", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# File upload constraints
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/x-png"
]
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

# Active connections storage
rooms: Dict[str, Set[WebSocket]] = {}

@app.websocket("/ws/{username}/{room}")
async def websocket_endpoint(websocket: WebSocket, username: str, room: str):
    try:
        await websocket.accept()
        
        # Validate unique username
        existing_users = [ws.url.path.split("/")[-2] for ws in rooms.get(room, set())]
        if username in existing_users:
            error_msg = f"🚨 Erro: O nome '{username}' já está em uso na sala '{room}'"
            await websocket.send_text(error_msg)
            await websocket.close(code=1008, reason=error_msg)
            return

        # Register connection
        if room not in rooms:
            rooms[room] = set()
        rooms[room].add(websocket)
        logger.info(f"{username} joined room {room}")

        try:
            await send_online_users(room)
            await broadcast_message(f"🚀 {username} entrou na sala!", room)

            while True:
                try:
                    data = await websocket.receive_text()
                    
                    # Image message handling
                    if data.startswith("img:"):
                        logger.debug(f"Image message from {username}")
                        await handle_image_message(data, room)
                    # Private message handling
                    elif data.startswith("privado:"):
                        await handle_private_message(data, username, room)
                    # Normal message handling
                    else:
                        await broadcast_message(f"{username}: {data}", room)

                except WebSocketDisconnect:
                    raise
                except Exception as e:
                    logger.error(f"Message processing error: {str(e)}")
                    await websocket.send_text("⚠️ Erro ao processar mensagem")

        except WebSocketDisconnect:
            await handle_disconnect(username, room)
            
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.close(code=1011, reason="Internal error")
        except:
            pass

async def handle_image_message(data: str, room: str):
    """Special handling for image messages"""
    try:
        await broadcast_message(data, room)
    except Exception as e:
        logger.error(f"Image broadcast failed: {str(e)}")
        raise

async def handle_private_message(data: str, sender: str, room: str):
    """Handle private messages"""
    try:
        _, target_user, message = data.split(":", 2)
        await send_private_message(sender, target_user, message, room)
    except ValueError:
        logger.warning("Invalid private message format")
        raise

async def handle_disconnect(username: str, room: str):
    """Clean up after disconnect"""
    if room in rooms and username in [ws.url.path.split("/")[-2] for ws in rooms[room]]:
        rooms[room] = {ws for ws in rooms[room] if ws.url.path.split("/")[-2] != username}
        logger.info(f"{username} left room {room}")
        await broadcast_message(f"👋 {username} saiu da sala.", room)
        await send_online_users(room)

@app.post("/upload/{username}/{room}")
async def upload_image(username: str, room: str, file: UploadFile = File(...)):
    """Handle image uploads with enhanced error handling"""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(400, detail="No file provided")

        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, detail=f"File extension {file_ext} not allowed")

        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, detail=f"Content type {file.content_type} not supported")

        # Read and validate file size
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(413, detail="File too large")

        # Process image
        try:
            return await process_and_save_image(username, contents, file_ext)
        except (UnidentifiedImageError, Image.DecompressionBombError) as e:
            raise HTTPException(400, detail="Invalid image file")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(500, detail="Image processing error")

async def process_and_save_image(username: str, contents: bytes, file_ext: str):
    """Process and save image with proper formatting"""
    with Image.open(io.BytesIO(contents)) as image:
        # Convert image format
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGBA')
            file_ext = '.png'
            format = 'PNG'
        else:
            image = image.convert('RGB')
            file_ext = '.jpg'
            format = 'JPEG'

        # Resize maintaining aspect ratio
        image.thumbnail((800, 800), Image.LANCZOS)
        
        # Generate unique filename
        filename = f"{username}_{uuid.uuid4().hex[:6]}{file_ext}"
        save_path = os.path.join(UPLOAD_DIR, filename)
        
        # Save optimized image
        image.save(
            save_path,
            format=format,
            optimize=True,
            quality=85,
            progressive=True
        )
        
        logger.info(f"Image saved: {filename} ({image.size[0]}x{image.size[1]})")
        
        return { 
            "status": "success",
            "url": f"/{UPLOAD_DIR}/{filename}",
            "absolute_url": f"https://whatsapp4.onrender.com/{UPLOAD_DIR}/{filename}",
            "filename": filename,
            "dimensions": {
                "width": image.size[0],
                "height": image.size[1]
            },
            "size": os.path.getsize(save_path)
        }

# Helper functions
async def broadcast_message(message: str, room: str):
    """Broadcast message to all in room with connection handling"""
    if room not in rooms:
        return

    dead_connections = []
    for ws in rooms[room]:
        try:
            await ws.send_text(message)
        except Exception as e:
            logger.warning(f"Failed to send to {ws}: {str(e)}")
            dead_connections.append(ws)
    
    # Clean up dead connections
    for ws in dead_connections:
        rooms[room].remove(ws)

async def send_private_message(sender: str, target: str, message: str, room: str):
    """Send private message with error handling"""
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
    """Send updated user list to room"""
    if room in rooms:
        users = [ws.url.path.split("/")[-2] for ws in list(rooms[room])]
        await broadcast_message(f"👥 Online ({room}): {', '.join(users)}", room)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
