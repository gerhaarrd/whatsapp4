Chat App - Multiroom WebSocket Chat Application
📝 Descrição
Este projeto é um aplicativo de chat em tempo real baseado em WebSocket que permite aos usuários se comunicarem em salas públicas ou privadas. Desenvolvido com FastAPI no backend e HTML/CSS/JavaScript no frontend, o aplicativo oferece recursos como:

Chat em tempo real com mensagens públicas e privadas

Lista de usuários online em cada sala

Notificações de entrada/saída de usuários

Interface responsiva e moderna

✨ Funcionalidades
Salas de Chat: Os usuários podem entrar em salas públicas (padrão) ou criar suas próprias salas privadas

Mensagens Privadas: Envie mensagens diretas para outros usuários na mesma sala

Lista de Usuários Online: Visualize todos os usuários conectados na sala atual

Notificações: Receba alertas quando usuários entram ou saem da sala

Interface Intuitiva: Design limpo e fácil de usar

🛠️ Tecnologias Utilizadas
Frontend:

HTML5, CSS3, JavaScript (ES6)

WebSocket API para comunicação em tempo real

Backend:

Python 3.x

FastAPI (framework web)

WebSockets para comunicação bidirecional

Uvicorn (servidor ASGI)

🚀 Como Executar
Pré-requisitos
Python 3.7+

Pip (gerenciador de pacotes Python)

Instalação e Execução
Clone o repositório:

bash
Copy
git clone https://github.com/seu-usuario/chat-app.git
cd chat-app
Instale as dependências:

bash
Copy
pip install fastapi uvicorn
Execute o servidor:

bash
Copy
python server.py
Acesse a aplicação:

Abra o arquivo index.html em um navegador moderno

Ou hospede os arquivos estáticos em um servidor web simples

🌐 Deploy
O aplicativo pode ser facilmente implantado em serviços como:

Render.com

Heroku

Vercel (para frontend) + servidor FastAPI separado
