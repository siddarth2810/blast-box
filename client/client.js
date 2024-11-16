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

const player = new Player(x, y, 10, "white");

let animationId;

function animate() {
  animationId = requestAnimationFrame(animate);
  c.fillStyle = "rgba(0,0,0,0.1)";
  c.fillRect(0, 0, canvas.width, canvas.height);

  player.draw();
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
        console.log("Current players:", data.players);
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
