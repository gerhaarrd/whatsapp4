let socket;
let username = "";

function connect() {
    username = document.getElementById("username").value.trim();
    if (username === "") {
        alert("Digite um nome!");
        return;
    }

    socket = new WebSocket(`ws://localhost:10000/ws/${username}`);

    socket.onopen = () => {
        console.log("Conectado ao WebSocket!");
        document.getElementById("telaLogin").style.display = "none";
        document.getElementById("chat").style.display = "block";
    };

    socket.onerror = (error) => {
        console.error("Erro na conexão WebSocket:", error);
    };

    socket.onclose = () => {
        console.log("Conexão WebSocket fechada.");
    };

    socket.onmessage = (event) => {
        const msg = event.data;
        const messageElement = document.createElement("div");
        
        if (msg.startsWith("👥 Usuários online:")) {
            const userList = msg.replace("👥 Usuários online:", "").trim().split(", ");
            updateUserList(userList);
        } else {
            messageElement.textContent = msg;
            if (msg.includes(username)) {
                messageElement.classList.add("receiver");
            } else {
                messageElement.classList.add("sender");
            }
            document.getElementById("chatMessages").appendChild(messageElement);
        }
    };
}

function sendMessage() {
    const input = document.getElementById("message");
    const message = input.value.trim();
    
    if (message === "") return;

    socket.send(message);
    input.value = "";
}

function sendPrivateMessage() {
    const input = document.getElementById("message");
    const message = input.value.trim();
    const recipient = prompt("Para quem você deseja enviar a mensagem privada?");

    if (message === "" || recipient === "") return;

    const formattedMessage = `${recipient}:${message}`;
    socket.send(formattedMessage);
    input.value = "";
}

function updateUserList(userList) {
    const userListElement = document.getElementById("userList");
    userListElement.innerHTML = "";

    userList.forEach(user => {
        const userElement = document.createElement("div");
        userElement.textContent = user;
        userListElement.appendChild(userElement);
    });
}

function logout() {
    socket.close();
    document.getElementById("chat").style.display = "none";
    document.getElementById("telaLogin").style.display = "block";
    document.getElementById("username").value = "";
}
