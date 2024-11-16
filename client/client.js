import { Player } from "./Player.js";
const url = "ws://localhost:8080";
const ws = new WebSocket(url);

const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

const scoreEl = document.querySelector("#scoreEl");

canvas.width = innerWidth;
canvas.height = innerHeight;

const x = canvas.width / 2;
const y = canvas.height / 2;

//const player = new Player(x, y, 10, "white");
const players = {};

let animationId;

function animate() {
  animationId = requestAnimationFrame(animate);
  c.fillStyle = "rgba(0,0,0,0.1)";
  c.fillRect(0, 0, canvas.width, canvas.height);
  for (const id in players) {
    const player = players[id];
    player.draw();
  }
}
animate();
ws.addEventListener("open", () => {
  console.log("Connected to the server");

  // Send a test message to the server
  ws.send(
    JSON.stringify({
      type: "test",
      message: "Hello, server!",
    }),
  );
});

ws.addEventListener("message", (event) => {
  try {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case "welcome":
        console.log("Server says:", data.message);
        break;

      case "updatePlayers":
        const backendPlayers = data.backendPlayers;
        for (const id in backendPlayers) {
          const backendPlayer = backendPlayers[id];
          if (!players[id]) {
            players[id] = new Player(
              backendPlayer.x,
              backendPlayer.y,
              15,
              "hsl(0,100%,50%)",
            );
          }
        }
        //loop and delete the front end players to update the site
        for (const id in players) {
          if (!backendPlayers[id]) {
            delete players[id];
          }
        }
        console.log(players);
        break;

      default:
        console.log("Unknown message type:", data);
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
});

ws.addEventListener("close", (event) => {
  console.log("Connection closed:", event.code, event.reason);
});
