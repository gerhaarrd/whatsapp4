class ChatApp {
    constructor() {
        this.socket = null;
        this.username = "";
        this.currentRoom = "";
        this.chatMessages = document.getElementById("chatMessages");
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Connect button
        document.getElementById("connectButton").addEventListener("click", () => this.connect());
        
        // Message input
        document.getElementById("message").addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Private message button
        document.getElementById("privateButton").addEventListener("click", () => this.sendPrivateMessage());
        
        // Logout button
        document.getElementById("logoutButton").addEventListener("click", () => this.logout());
    }

    connect() {
    this.username = document.getElementById("username").value.trim();
    this.currentRoom = document.getElementById("room").value.trim() || "public";

    if (!this.username) {
        alert("Please enter a valid username!");
        return;
    }

    try {
        // Corrected WebSocket URL with proper parentheses
        this.socket = new WebSocket(
            `wss://whatsapp4.onrender.com/ws/${
                encodeURIComponent(this.username)
            }/${
                encodeURIComponent(this.currentRoom)
            }`
        );

        this.socket.onopen = () => this.handleConnectionOpen();
        this.socket.onerror = (error) => this.handleConnectionError(error);
        this.socket.onclose = (event) => this.handleConnectionClose(event);
        this.socket.onmessage = (event) => this.processMessage(event.data);

    } catch (error) {
        console.error("Connection error:", error);
        this.addSystemMessage("Connection error", true);
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
        this.addSystemMessage("Connection error. Reconnecting...", true);
        setTimeout(() => this.connect(), 3000);
    }

    handleConnectionClose(event) {
        if (!event.wasClean) {
            this.addSystemMessage("Connection lost. Reconnecting...");
            setTimeout(() => this.connect(), 3000);
        }
    }

    processMessage(msg) {
        if (msg.startsWith("👥 Online:")) {
            this.updateUserList(msg.replace("👥 Online:", "").trim());
            return;
        }

        const messageElement = document.createElement("div");

        if (msg.startsWith("🔒")) {
            messageElement.className = "private-message";
            messageElement.textContent = msg;
        } else if (msg.match(/^(🚀|👋|⚠️|🚨)/)) {
            messageElement.className = "system-message";
            messageElement.textContent = msg;
        } else {
            messageElement.className = msg.includes(this.username) ? "receiver" : "sender";
            messageElement.textContent = msg;
        }

        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
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

        const onlineUsers = this.getOnlineUsers();
        if (!onlineUsers) {
            alert("No online users available");
            return;
        }

        const recipient = prompt(`Send private to:\n(Online: ${onlineUsers})`);
        if (!recipient) return;

        this.socket.send(`privado:${recipient}:${message}`);
        input.value = "";
    }

    updateUserList(userListStr) {
        const users = userListStr ? userListStr.split(", ") : [];
        const userListElement = document.getElementById("userList");
        userListElement.innerHTML = `
            <h3>Online Users 👥 <small>(${users.length})</small></h3>
            ${users.map(user => `
                <div class="online-user" onclick="window.chat.setPrivateMessage('${user}')">
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
        return users.filter(u => u !== this.username).join(', ');
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

// Initialize as global variable
window.chat = new ChatApp();
