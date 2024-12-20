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

window.addEventListener("keydown", (event) => {
  //if (!currentPlayerId || !frontEndPlayers[currentPlayerId]) return;

  const player = frontEndPlayers[currentPlayerId];
  if (event.code == "KeyW" || event.code == "ArrowUp") {
    player.y -= 10;
  }
  if (event.code == "KeyS" || event.code == "ArrowDown") {
    player.y += 10;
  }
  if (event.code == "KeyA" || event.code == "ArrowLeft") {
    player.x -= 10;
  }
  if (event.code == "KeyD" || event.code == "ArrowRight") {
    player.x += 10;
  }

  //update in the backend
  ws.send(
    JSON.stringify({
      type: "position",
      id: currentPlayerId,
      key: event.code,
    }),
  );
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

      case "updatePlayers":
        const backEndPlayers = data.backEndPlayers || {};

        // Update or add players
        for (const id in backEndPlayers) {
          const backEndPlayer = backEndPlayers[id];
          const frontEndPlayer = frontEndPlayers[id];

          if (frontEndPlayer) {
            // Smoothly reconcile differences
            if (id === currentPlayerId) {
              // For the current player, compare predicted vs. server position
              frontEndPlayer.x += (backEndPlayer.x - frontEndPlayer.x) * 0.2;
              frontEndPlayer.y += (backEndPlayer.y - frontEndPlayer.y) * 0.2;
            } else {
              // For other players, directly update
              frontEndPlayer.x = backEndPlayer.x;
              frontEndPlayer.y = backEndPlayer.y;
            }
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
        console.log("after the loop");
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
