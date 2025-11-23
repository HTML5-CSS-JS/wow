// server.js
// 간단한 WebSocket 샌드박스 서버 예제

const http = require("http");
const WebSocket = require("ws");

// Render 같은 플랫폼은 PORT 환경변수를 자동으로 설정합니다.
const PORT = process.env.PORT || 3000;

// HTTP 서버 (필수: Render가 health check용으로 접근)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket Sandbox Server Running");
});

// WebSocket 서버
const wss = new WebSocket.Server({ server });

let nextId = 1;
let players = {};   // {id: {name,x,y}}
let world = {};     // {"x,y": "tileType"}

// 모든 클라이언트에 메시지 브로드캐스트
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on("connection", ws => {
  const id = nextId++;
  players[id] = { id, name: "익명", x: 0, y: 0 };

  // 초기 정보 전송
  ws.send(JSON.stringify({ type: "init", id, name: players[id].name, x: 0, y: 0 }));
  ws.send(JSON.stringify({ type: "world", world }));
  broadcast({ type: "players", players });

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "move") {
        players[id].x = data.x;
        players[id].y = data.y;
      }

      if (data.type === "place") {
        const key = `${data.x},${data.y}`;
        world[key] = data.tile;
        broadcast({ type: "patch", world: { [key]: data.tile } });
      }

      if (data.type === "erase") {
        const key = `${data.x},${data.y}`;
        delete world[key];
        broadcast({ type: "patch", world: { [key]: null } });
      }

      if (data.type === "rename") {
        players[id].name = data.name;
        broadcast({ type: "players", players });
      }

      if (data.type === "chat") {
        broadcast({ type: "chat", fromName: players[id].name, text: data.text });
      }
    } catch (e) {
      console.error("Invalid message", e);
    }
  });

  ws.on("close", () => {
    delete players[id];
    broadcast({ type: "players", players });
  });
});

// 주기적으로 전체 플레이어 상태 브로드캐스트
setInterval(() => {
  broadcast({ type: "players", players });
}, 200);

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
