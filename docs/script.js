class ChatApp {
    constructor() {
        this.socket = null;
        this.username = "";
        this.currentRoom = "";
        this.chatMessages = document.getElementById("chatMessages");
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById("message").addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        window.addEventListener('load', () => {
            if (window.location.hostname === 'localhost') {
                console.log("Development environment: localhost");
            }
        });
    }

    connect() {
        this.username = document.getElementById("username").value.trim();
        this.currentRoom = document.getElementById("room").value.trim() || "public";

        if (!this.username) {
            alert("Please enter a valid username!");
            return;
        }

        try {
            this.socket = new WebSocket(`wss://whatsapp4.onrender.com/ws/${encodeURIComponent(this.username)}/${encodeURIComponent(this.currentRoom)}`);

            this.socket.onopen = () => this.handleConnectionOpen();
            this.socket.onerror = (error) => this.handleConnectionError(error);
            this.socket.onclose = (event) => this.handleConnectionClose(event);
            this.socket.onmessage = (event) => this.processMessage(event.data);

        } catch (error) {
            console.error("Connection error:", error);
            alert("Connection error");
        }
    }

    handleConnectionOpen() {
        document.getElementById("telaLogin").style.display = "none";
        document.getElementById("chat").style.display = "flex";
        document.getElementById("roomName").textContent = this.currentRoom;
        this.chatMessages.innerHTML = '';
        
        this.addSystemMessage(`Welcome to room ${this.currentRoom}, ${this.username}!`);
    }

    handleConnectionError(error) {
        console.error("Connection error:", error);
        this.addSystemMessage("Connection error", true);
    }

    handleConnectionClose(event) {
        if (!event.wasClean) {
            this.addSystemMessage("Reconnecting...");
            setTimeout(() => this.connect(), 3000);
        }
    }

    processMessage(msg) {
        if (msg.startsWith("👥 Online")) {
            this.updateUserList(msg.split(":")[1].trim());
            return;
        }

        const messageElement = document.createElement("div");
        
        if (msg.match(/^(👥|🚀|👋|⚠️|🚨)/)) {
            messageElement.className = "system-message";
            messageElement.textContent = msg;
        }
        else if (msg.startsWith("img:")) {
            this.handleImageMessage(msg, messageElement);
        }
        else if (msg.startsWith("🔒")) {
            messageElement.className = "private-message";
            messageElement.textContent = msg;
        }
        else {
            messageElement.className = msg.includes(this.username) ? "receiver" : "sender";
            messageElement.textContent = msg;
        }

        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    handleImageMessage(msg, container) {
        const imgUrl = msg.slice(4);
        const sender = imgUrl.split('_')[0];
        
        container.className = "message-container";
        const img = document.createElement("img");
        img.className = "chat-image";
        img.onerror = () => {
            img.src = 'images/image-error.png';
            img.alt = 'Image failed to load';
        };
        img.src = `https://whatsapp4.onrender.com${imgUrl}`;
        
        container.innerHTML = `<div class="image-sender">${sender === this.username ? "You" : sender}</div>`;
        container.appendChild(img);
    }

    addSystemMessage(text, isError = false) {
        const msg = document.createElement("div");
        msg.className = `system-message ${isError ? 'error' : ''}`;
        msg.textContent = text;
        this.chatMessages.appendChild(msg);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    sendMessage() {
        const input = document.getElementById("message");
        const message = input.value.trim();
        
        if (!message || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        try {
            this.socket.send(message);
            input.value = "";
        } catch (error) {
            console.error("Send error:", error);
            this.addSystemMessage("Message send failed", true);
        }
    }

    sendPrivateMessage() {
        const input = document.getElementById("message");
        const message = input.value.trim();
        
        if (!message) {
            alert("Please enter a message!");
            return;
        }

        const recipient = prompt(`Send private to:\n(Online: ${this.getOnlineUsers()})`);
        if (!recipient) return;

        this.socket.send(`privado:${recipient}:${message}`);
        input.value = "";
    }

    async sendImage() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            alert("Please connect first");
            return;
        }

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const formData = new FormData();
                formData.append("file", file);

                const response = await fetch(
                    `https://whatsapp4.onrender.com/upload/${encodeURIComponent(this.username)}/${encodeURIComponent(this.currentRoom)}`, 
                    { method: "POST", body: formData }
                );

                if (!response.ok) throw new Error("Upload failed");
                
                const result = await response.json();
                this.socket.send(`img:${result.url}`);

            } catch (error) {
                console.error("Upload error:", error);
                this.addSystemMessage("Image upload failed", true);
            }
        };
        
        input.click();
    }

    updateUserList(userList) {
        const users = userList ? userList.split(", ") : [];
        const userListElement = document.getElementById("userList");
        userListElement.innerHTML = `
            <h3>Online Users 👥 <small>(${users.length})</small></h3>
            ${users.map(user => `
                <div class="online-user" onclick="chat.setPrivateMessage('${user}')">
                    ${user} ${user === this.username ? '(you)' : ''}
                </div>
            `).join('')}
        `;
    }

    setPrivateMessage(user) {
        if (user === this.username) return;
        const input = document.getElementById("message");
        input.value = `privado:${user}: `;
        input.focus();
    }

    getOnlineUsers() {
        const users = Array.from(document.querySelectorAll('.online-user'))
            .map(el => el.textContent.trim().replace(' (you)', ''));
        return users.join(', ');
    }

    logout() {
        if (this.socket) {
            this.socket.close(1000, "User logout");
        }
        document.getElementById("chat").style.display = "none";
        document.getElementById("telaLogin").style.display = "block";
        document.getElementById("username").value = "";
        document.getElementById("room").value = "";
    }
}

// Initialize chat application
const chat = new ChatApp();
