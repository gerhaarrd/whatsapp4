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
    }

    connect() {
        this.username = document.getElementById("username").value.trim();
        this.currentRoom = document.getElementById("room").value.trim() || "public";

        if (!this.username) {
            alert("Por favor, digite um nome de usuário válido!");
            return;
        }

        try {
            this.socket = new WebSocket(`wss://whatsapp4.onrender.com/ws/${encodeURIComponent(this.username)}/${encodeURIComponent(this.currentRoom)}`);

            this.socket.onopen = () => this.handleConnectionOpen();
            this.socket.onerror = (error) => this.handleConnectionError(error);
            this.socket.onclose = (event) => this.handleConnectionClose(event);
            this.socket.onmessage = (event) => this.processMessage(event.data);

        } catch (error) {
            console.error("Erro de conexão:", error);
            this.addSystemMessage("Erro na conexão", true);
        }
    }

    handleConnectionOpen() {
        document.getElementById("telaLogin").style.display = "none";
        document.getElementById("chat").style.display = "flex";
        document.getElementById("roomName").textContent = this.currentRoom;
        this.chatMessages.innerHTML = '';
        this.addSystemMessage(`Bem-vindo à sala ${this.currentRoom}, ${this.username}!`);
    }

    handleConnectionError(error) {
        console.error("Erro de conexão:", error);
        this.addSystemMessage("Erro na conexão. Tentando reconectar...", true);
        setTimeout(() => this.connect(), 3000);
    }

    handleConnectionClose(event) {
        if (!event.wasClean) {
            this.addSystemMessage("Conexão perdida. Reconectando...");
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
            console.error("Erro ao enviar:", error);
            this.addSystemMessage("Falha ao enviar mensagem", true);
        }
    }

    sendPrivateMessage() {
        const input = document.getElementById("message");
        const message = input.value.trim();

        if (!message) {
            alert("Por favor, digite uma mensagem!");
            return;
        }

        const onlineUsers = this.getOnlineUsers();
        if (!onlineUsers) {
            alert("Nenhum usuário online no momento");
            return;
        }

        const recipient = prompt(`Enviar privado para:\n(Online: ${onlineUsers})`);
        if (!recipient) return;

        this.socket.send(`privado:${recipient}:${message}`);
        input.value = "";
    }

    updateUserList(userListStr) {
        const users = userListStr ? userListStr.split(", ") : [];
        const userListElement = document.getElementById("userList");
        userListElement.innerHTML = `
            <h3>Usuários Online 👥 <small>(${users.length})</small></h3>
            ${users.map(user => `
                <div class="online-user" onclick="chat.setPrivateMessage('${user}')">
                    ${user} ${user === this.username ? '(você)' : ''}
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
            .map(el => el.textContent.trim().replace(' (você)', ''));
        return users.filter(u => u !== this.username).join(', ');
    }

    logout() {
        if (this.socket) {
            this.socket.close(1000, "Logout do usuário");
        }
        document.getElementById("chat").style.display = "none";
        document.getElementById("telaLogin").style.display = "block";
        document.getElementById("username").value = "";
        document.getElementById("room").value = "";
    }
}

const chat = new ChatApp();
