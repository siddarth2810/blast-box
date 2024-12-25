import { Player } from "./Player.js";
const url = "ws://localhost:8000";
const ws = new WebSocket(url);

const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

const scoreEl = document.querySelector("#scoreEl");
const devicePixelRatio = window.devicePixelRatio || 1;

canvas.width = innerWidth * devicePixelRatio;
canvas.height = innerHeight * devicePixelRatio;

const x = canvas.width / 2;
const y = canvas.height / 2;

//const player = new Player(x, y, 10, "white");
const frontEndPlayers = {};
let seqNumber = 0;
const playerInputs = [];

let animationId;

function animate() {
  animationId = requestAnimationFrame(animate);
  c.fillStyle = "rgba(0,0,0,0.1)";
  c.fillRect(0, 0, canvas.width, canvas.height);
  for (const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id];
    frontEndPlayer.draw();
  }
}
animate();

let currentPlayerId = null;
let pendingInputs = [];

window.addEventListener("keydown", (event) => {
  if (!currentPlayerId || !frontEndPlayers[currentPlayerId]) return;

  const speed = 50;
  let dx = 0,
    dy = 0;
  if (event.code === "KeyW" || event.code === "ArrowUp") dy = -speed;
  if (event.code === "KeyS" || event.code === "ArrowDown") dy = speed;
  if (event.code === "KeyA" || event.code === "ArrowLeft") dx = -speed;
  if (event.code === "KeyD" || event.code === "ArrowRight") dx = speed;

  if (dx !== 0 || dy !== 0) {
    seqNumber++;
    pendingInputs.push({ seqNumber, dx, dy });

    // Client-Side Prediction
    const player = frontEndPlayers[currentPlayerId];
    player.x += dx;
    player.y += dy;

    ws.send(
      JSON.stringify({
        type: "position",
        seqNumber: seqNumber,
        dx: dx,
        dy: dy,
      }),
    );
  }
});

ws.addEventListener("message", (event) => {
  try {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case "welcome":
        console.log("Server says this:", data.message);
        console.log(frontEndPlayers); //gives empty object
        currentPlayerId = data.id;
        console.log(currentPlayerId);
        break;

      case "updatePosition":
        const { id, x, y, backEndPlayer } = data;
        if (!frontEndPlayers[id]) return;

        // Update the authoritative position
        frontEndPlayers[id].x = x;
        frontEndPlayers[id].y = y;

        const lastBackendInputIndex = playerInputs.findIndex((input) => {
          return backEndPlayer.seqNumber === input.seqNumber;
        });
        if (lastBackendInputIndex > -1) {
          playerInputs.splice(0, lastBackendInputIndex + 1);
        }

        // Reapply remaining, unacknowledged inputs
        for (const input of pendingInputs) {
          frontEndPlayers[id].x += input.dx;
          frontEndPlayers[id].y += input.dy;
        }

      case "updatePlayers":
        const backEndPlayers = data.backEndPlayers || {};
        // Update or add players
        for (const id in backEndPlayers) {
          const backEndPlayer = backEndPlayers[id];
          const frontEndPlayer = frontEndPlayers[id];
          if (frontEndPlayer) {
            frontEndPlayer.x = backEndPlayer.x;
            frontEndPlayer.y = backEndPlayer.y;
          } else {
            // Add new players
            frontEndPlayers[id] = new Player({
              x: backEndPlayer.x,
              y: backEndPlayer.y,
              radius: 15,
              color: backEndPlayer.color,
            });
          }
        }
        //loop and delete the front end players to update the site
        for (const id in frontEndPlayers) {
          if (!backEndPlayers[id]) {
            delete frontEndPlayers[id];
          }
        }
        console.log(frontEndPlayers);
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
